// src/utils/voiceManager.ts (updated with queue system)
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    AudioResource,
} from '@discordjs/voice';
import type { Interaction } from 'discord.js';
import { CommandInteraction, GuildMember } from 'discord.js';
import type { Readable } from 'stream';
import type { SongInfo } from '../services/userDataService';

// Queue item interface
interface QueueItem {
    song: SongInfo;
    requestedBy: string; // User ID who requested the song
}

export class VoiceManager {
    private static connections = new Map();
    private static players = new Map();
    private static resources = new Map();
    private static volumes = new Map<string, number>(); // Store volume levels per guild
    private static DEFAULT_VOLUME = 0.2; // 20% volume by default
    private static currentlyPlaying = new Map<string, SongInfo>();
    private static queues = new Map<string, QueueItem[]>(); // Store queues per guild
    private static loopMode = new Map<string, 'none' | 'song' | 'queue'>(); // Loop modes per guild

    /**
     * Checks if audio is currently playing in a guild
     * @param guildId - The Discord guild ID
     * @returns true if there's active playback in the guild, false otherwise
     */
    static isPlaying(guildId: string): boolean {
        return this.currentlyPlaying.has(guildId);
    }

    /**
     * Gets the position of a song in the queue
     * @param guildId - The Discord guild ID
     * @param mapId - The map ID of the song to find
     * @returns The 1-based position of the song in the queue, or null if not found
     */
    static getQueuePosition(guildId: string, mapId: number): number | null {
        const queue = this.queues.get(guildId);
        if (!queue) return null;

        const position = queue.findIndex(item => item.song.mapId === mapId);
        return position !== -1 ? position + 1 : null;
    }

    private static async followUp(interaction: Interaction, content: string) {
        if (interaction.isRepliable()) {
            await interaction.followUp(content);
        }
    }

    /**
     * Plays an audio stream in a voice channel
     * @param interaction - The Discord interaction that triggered the playback
     * @param stream - The readable audio stream to play
     * @param mapName - The name of the map/song to play
     * @param mapId - The ID of the map
     * @param replyInteraction - The interaction to reply to with status messages
     * @returns A promise that resolves to true if playback started successfully, false otherwise
     */
    static async playAudioInChannel(
        interaction: Interaction,
        stream: Readable,
        mapName: string,
        mapId: number,
        replyInteraction: Interaction,
    ): Promise<boolean> {
        try {
            console.log(`[DEBUG] Starting voice playback with interaction user: ${interaction.user.tag}`);

            if (!interaction.guild) {
                console.log('[ERROR] This interaction doesn\'t have guild information');
                await this.followUp(replyInteraction, 'Command must be used in a server');
                return false;
            }

            const guild = interaction.guild;
            console.log(`[DEBUG] Using guild directly: ${guild.name} (${guild.id})`);

            try {
                // Fetch fresh member info to get current voice state
                const member = await guild.members.fetch(interaction.user.id);
                console.log(`[DEBUG] Member fetched: ${member.user.tag}`);

                if (!member.voice.channel) {
                    console.log('[ERROR] User not in a voice channel');
                    await this.followUp(replyInteraction, 'You need to join a voice channel first!');
                    return false;
                }

                const voiceChannel = member.voice.channel;
                console.log(`[DEBUG] Voice channel: ${voiceChannel.name} (${voiceChannel.id})`);

                // Check bot's permissions
                const me = guild.members.me;
                if (!me) {
                    console.log('[ERROR] Bot member not found in guild');
                    await this.followUp(replyInteraction, 'Bot configuration error. Please try again later.');
                    return false;
                }

                const permissions = voiceChannel.permissionsFor(me);
                if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
                    console.log('[ERROR] Missing voice permissions');
                    await this.followUp(replyInteraction, 'I need permissions to join and speak in your voice channel!');
                    return false;
                }

                // Clean up any existing connection
                const existingConnection = getVoiceConnection(guild.id);
                if (existingConnection) {
                    console.log('[DEBUG] Destroying existing connection');
                    existingConnection.destroy();
                    this.connections.delete(guild.id);
                    this.players.delete(guild.id);
                    this.resources.delete(guild.id);
                }

                // Create new connection
                console.log(`[DEBUG] Creating voice connection to ${voiceChannel.name}`);
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator as any,
                    selfDeaf: false,
                    selfMute: false,
                });

                this.connections.set(guild.id, connection);

                // Set up connection state logging
                connection.on(VoiceConnectionStatus.Connecting, () => {
                    console.log('[DEBUG] Voice connection connecting...');
                });

                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log('[DEBUG] Voice connection ready!');
                });

                connection.on('error', (error) => {
                    console.error('[ERROR] Voice connection error:', error);
                });

                // Wait for ready state
                try {
                    console.log('[DEBUG] Waiting for voice connection ready state...');
                    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                    console.log('[DEBUG] Voice connection ready!');
                } catch (readyError) {
                    console.error('[ERROR] Voice connection failed to become ready:', readyError);
                    await this.followUp(replyInteraction, 'Failed to connect to voice channel. Please try again.');
                    connection.destroy();
                    this.connections.delete(guild.id);
                    return false;
                }

                // Create audio player
                console.log('[DEBUG] Creating audio player');
                const player = createAudioPlayer();
                this.players.set(guild.id, player);

                // Subscribe connection to player
                console.log('[DEBUG] Subscribing connection to player');
                const subscription = connection.subscribe(player);

                if (!subscription) {
                    console.error('[ERROR] Failed to subscribe to audio player');
                    await this.followUp(replyInteraction, 'Error setting up audio playback');
                    connection.destroy();
                    this.connections.delete(guild.id);
                    return false;
                }

                // Get the volume for this guild (default if not set)
                const volume = this.volumes.get(guild.id) || this.DEFAULT_VOLUME;
                console.log(`[DEBUG] Using volume level: ${volume}`);

                // Create and play audio resource with volume
                console.log('[DEBUG] Creating audio resource');
                const resource = createAudioResource(stream, {
                    inlineVolume: true,
                });

                // Set volume
                resource.volume?.setVolume(volume);

                // Store resource for volume adjustments later
                this.resources.set(guild.id, resource);

                console.log('[DEBUG] Playing audio');
                player.play(resource);

                const mapMatch = mapName.match(/(.+) \((.+)\)/);
                if (mapMatch && interaction.guildId) {
                    // Assuming the format is "MapName (StreetName)"
                    const songInfo: SongInfo = {
                        mapId: Number(mapId),
                        mapName: mapMatch[1],
                        streetName: mapMatch[2],
                        region: 'gms', // Default region
                        version: '253', // Default version
                    };

                    // Store as currently playing
                    this.currentlyPlaying.set(interaction.guildId, songInfo);
                }

                // Player state handlers
                player.on(AudioPlayerStatus.Playing, () => {
                    console.log('[DEBUG] Player is now playing audio');
                });

                player.on(AudioPlayerStatus.Idle, async () => {
                    console.log('[DEBUG] Player is idle - playback completed');

                    // Check if there are more songs in the queue
                    if (interaction.guildId && this.queues.has(interaction.guildId)) {
                        const queue = this.queues.get(interaction.guildId)!;

                        // Check if we need to loop the current song
                        const loopState = this.loopMode.get(interaction.guildId) || 'none';
                        const currentSong = this.currentlyPlaying.get(interaction.guildId);

                        if (loopState === 'song' && currentSong) {
                            // If we're looping the current song, play it again
                            console.log('[DEBUG] Song loop is enabled, playing the same song again');

                            try {
                                // Get new stream for the same song
                                const mapleApi = new (await import('../services/mapleApi')).MapleApiService();
                                const newStream = await mapleApi.getMapBgmStream(currentSong.mapId);

                                if (newStream) {
                                    // Play the song again
                                    await this.playAudioInChannel(
                                        interaction,
                                        newStream,
                                        `${currentSong.mapName} (${currentSong.streetName})`,
                                        currentSong.mapId,
                                        replyInteraction,
                                    );
                                    return;
                                }
                            } catch (error) {
                                console.error('[ERROR] Failed to loop song:', error);
                            }
                        } else if (queue.length > 0) {
                            // If queue is not empty, play the next song
                            console.log('[DEBUG] Playing next song in queue');

                            // Get the next song (remove from queue)
                            const nextItem = loopState === 'queue' ? queue[0] : queue.shift()!;

                            // If we're in queue loop mode, add the song back to the end of the queue
                            if (loopState === 'queue') {
                                queue.push(queue.shift()!);
                            }

                            try {
                                // Get stream for the next song
                                const mapleApi = new (await import('../services/mapleApi')).MapleApiService();
                                const newStream = await mapleApi.getMapBgmStream(nextItem.song.mapId);

                                if (newStream) {
                                    // Play the next song
                                    await this.playAudioInChannel(
                                        interaction,
                                        newStream,
                                        `${nextItem.song.mapName} (${nextItem.song.streetName})`,
                                        nextItem.song.mapId,
                                        replyInteraction,
                                    );

                                    // Notify that the next song is playing
                                    if (replyInteraction.isRepliable()) {
                                        await replyInteraction.followUp({
                                            content: `Now playing next song: ${nextItem.song.mapName} (${nextItem.song.streetName})`,
                                        });
                                    }
                                    return;
                                }
                            } catch (error) {
                                console.error('[ERROR] Failed to play next song:', error);
                            }
                        }
                    }

                    // If we reach here, either queue is empty or there was an error
                    // Clean up resources
                    if (interaction.guildId) {
                        this.currentlyPlaying.delete(interaction.guildId);
                    }

                    if (guild.id) {
                        const connection = this.connections.get(guild.id);
                        if (connection) {
                            connection.destroy();
                        }
                        this.connections.delete(guild.id);
                        this.players.delete(guild.id);
                        this.resources.delete(guild.id);
                    }
                });

                player.on('error', (error) => {
                    console.error('[ERROR] Player error:', error);
                    connection.destroy();
                    this.connections.delete(guild.id);
                    this.players.delete(guild.id);
                    this.resources.delete(guild.id);
                });

                // Handle disconnections
                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    console.log('[DEBUG] Voice disconnected, attempting reconnect...');
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (reconnectError) {
                        console.error('[ERROR] Couldn\'t reconnect:', reconnectError);
                        connection.destroy();
                        this.connections.delete(guild.id);
                        this.players.delete(guild.id);
                        this.resources.delete(guild.id);
                    }
                });

                return true;

            } catch (memberError) {
                console.error('[ERROR] Member fetch error:', memberError);
                await this.followUp(replyInteraction, 'Failed to get your user information. Please try again.');
                return false;
            }

        } catch (error) {
            console.error('[ERROR] Unexpected error:', error);
            await this.followUp(replyInteraction, 'There was an unexpected error. Please try again later.');
            return false;
        }
    }

    /**
     * Stops any active audio playback in a guild
     * @param guildId - The Discord guild ID
     * @returns true if playback was stopped, false if there was no active playback
     */
    static stopPlayback(guildId: string): boolean {
        const player = this.players.get(guildId);
        const connection = this.connections.get(guildId);

        if (player && connection) {
            console.log(`[DEBUG] Stopping playback in guild ${guildId}`);
            player.stop();
            connection.destroy();
            this.players.delete(guildId);
            this.connections.delete(guildId);
            this.resources.delete(guildId);
            this.currentlyPlaying.delete(guildId);
            return true;
        }

        return false;
    }

    /**
     * Sets the volume level for audio playback in a guild
     * @param guildId - The Discord guild ID
     * @param volumePercent - The volume level as a percentage (0-100)
     * @returns true if the volume was set successfully, false otherwise
     */
    static setVolume(guildId: string, volumePercent: number): boolean {
        // Ensure volume is between 0 and 100%
        const clampedVolume = Math.max(0, Math.min(100, volumePercent));
        // Convert percentage to decimal (0-1 range)
        const volumeDecimal = clampedVolume / 100;

        console.log(`[DEBUG] Setting volume for guild ${guildId} to ${clampedVolume}% (${volumeDecimal})`);

        // Store the volume setting for this guild
        this.volumes.set(guildId, volumeDecimal);

        // Update the current playback if it exists
        const resource = this.resources.get(guildId);
        if (resource?.volume) {
            resource.volume.setVolume(volumeDecimal);
            return true;
        }

        // If no active resource but we've stored the setting for next playback
        return this.volumes.has(guildId);
    }

    /**
     * Gets the current volume level for a guild
     * @param guildId - The Discord guild ID
     * @returns The current volume level as a percentage (0-100)
     */
    static getVolume(guildId: string): number {
        // Return volume as percentage (0-100)
        return (this.volumes.get(guildId) || this.DEFAULT_VOLUME) * 100;
    }

    /**
     * Gets information about the currently playing song in a guild
     * @param guildId - The Discord guild ID
     * @returns The song information if a song is playing, or null otherwise
     */
    static getCurrentlyPlaying(guildId: string): SongInfo | null {
        return this.currentlyPlaying.get(guildId) || null;
    }

    /**
     * Adds a song to the playback queue for a guild
     * @param guildId - The Discord guild ID
     * @param mapId - The ID of the map/song to add
     * @param mapName - The name of the map
     * @param streetName - The street name of the map
     * @param region - The region code (default: 'gms')
     * @param version - The version code (default: '253')
     * @returns A promise that resolves to true if the song was added successfully, false otherwise
     */
    static async addToQueue(
        guildId: string,
        mapId: number,
        mapName: string,
        streetName: string,
        region: string = 'gms',
        version: string = '253',
    ): Promise<boolean> {
        const song: SongInfo = {
            mapId,
            mapName,
            streetName,
            region,
            version,
        };

        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, []);
        }

        const queue = this.queues.get(guildId)!;
        queue.push({ song, requestedBy: 'user' });  // We don't have user ID here

        // If nothing is playing, start playing this song
        if (!this.currentlyPlaying.has(guildId)) {
            try {
                // Get the BGM stream
                const mapleApi = new (await import('../services/mapleApi')).MapleApiService();
                const stream = await mapleApi.getMapBgmStream(mapId);

                if (stream) {
                    // Create a dummy interaction to play the audio
                    // This is a workaround - in a real implementation, we'd want to have the original interaction
                    const dummyInteraction = {
                        guild: { id: guildId },
                        guildId,
                        isRepliable: () => false,
                    } as any;

                    await this.playAudioInChannel(
                        dummyInteraction,
                        stream,
                        `${mapName} (${streetName})`,
                        mapId,
                        dummyInteraction,
                    );
                }
            } catch (error) {
                console.error('[ERROR] Failed to auto-play first queue item:', error);
                return false;
            }
        }

        return true;
    }

    /**
     * Clears the playback queue for a guild
     * @param guildId - The Discord guild ID
     * @returns true if the queue was cleared, false if there was no queue
     */
    static clearQueue(guildId: string): boolean {
        if (this.queues.has(guildId)) {
            this.queues.set(guildId, []);
            return true;
        }
        return false;
    }

    /**
     * Removes a song from the queue at the specified index
     * @param guildId - The Discord guild ID
     * @param index - The index of the song to remove from the queue (0-based)
     * @returns The removed item or null if the index was invalid
     */
    static removeFromQueue(guildId: string, index: number): QueueItem | null {
        if (!this.queues.has(guildId)) {
            return null;
        }

        const queue = this.queues.get(guildId)!;

        if (index < 0 || index >= queue.length) {
            return null;
        }

        const [removed] = queue.splice(index, 1);
        return removed;
    }

    /**
     * Gets the current queue for a guild
     * @param guildId - The Discord guild ID
     * @returns An array of queued items, or an empty array if no queue exists
     */
    static getQueue(guildId: string): QueueItem[] {
        return this.queues.get(guildId) || [];
    }

    /**
     * Shuffles the current queue for a guild
     * @param guildId - The Discord guild ID
     * @returns true if the queue was shuffled, false if there was no queue or not enough items to shuffle
     */
    static shuffleQueue(guildId: string): boolean {
        if (!this.queues.has(guildId)) {
            return false;
        }

        const queue = this.queues.get(guildId)!;

        if (queue.length <= 1) {
            return false;
        }

        // Fisher-Yates shuffle algorithm
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        return true;
    }

    /**
     * Skips to the next song in the queue
     * @param guildId - The Discord guild ID
     * @returns true if the skip was successful, false if there was no active playback
     */
    static skipToNext(guildId: string): boolean {
        const player = this.players.get(guildId);

        if (player) {
            // Stop current playback, which will trigger the "idle" event
            // and automatically play the next song in queue
            player.stop();
            return true;
        }

        return false;
    }

    /**
     * Sets the loop mode for playback
     * @param guildId - The Discord guild ID
     * @param mode - The loop mode ('none', 'song', or 'queue')
     * @returns The new loop mode
     */
    static setLoopMode(guildId: string, mode: 'none' | 'song' | 'queue'): string {
        this.loopMode.set(guildId, mode);
        return mode;
    }

    /**
     * Gets the current loop mode for a guild
     * @param guildId - The Discord guild ID
     * @returns The current loop mode ('none', 'song', or 'queue')
     */
    static getLoopMode(guildId: string): string {
        return this.loopMode.get(guildId) || 'none';
    }

    /**
     * Moves a song from one position to another in the queue
     * @param guildId - The Discord guild ID
     * @param fromIndex - The current index of the song (0-based)
     * @param toIndex - The desired index for the song (0-based)
     * @returns true if the song was moved successfully, false otherwise
     */
    static moveInQueue(guildId: string, fromIndex: number, toIndex: number): boolean {
        if (!this.queues.has(guildId)) {
            return false;
        }

        const queue = this.queues.get(guildId)!;

        if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
            return false;
        }

        // Remove the item from its current position
        const [item] = queue.splice(fromIndex, 1);

        // Insert it at the new position
        queue.splice(toIndex, 0, item);

        return true;
    }
}
