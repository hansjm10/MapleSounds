// src/utils/voiceManager.ts (updated with volume control)
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    AudioResource
} from '@discordjs/voice';
import { CommandInteraction, Interaction, GuildMember } from 'discord.js';
import { Readable } from 'stream';
import {SongInfo} from "../services/userDataService";

export class VoiceManager {
    private static connections = new Map();
    private static players = new Map();
    private static resources = new Map();
    private static volumes = new Map<string, number>(); // Store volume levels per guild
    private static DEFAULT_VOLUME = 0.2; // 20% volume by default
    private static currentlyPlaying = new Map<string, SongInfo>();

    private static async followUp(interaction: Interaction, content: string) {
        if (interaction.isRepliable()) {
            await interaction.followUp(content);
        }
    }

    static async playAudioInChannel(
        interaction: Interaction,
        stream: Readable,
        mapName: string,
        mapId: number,
        replyInteraction: Interaction
    ): Promise<void> {
        try {
            console.log(`[DEBUG] Starting voice playback with interaction user: ${interaction.user.tag}`);

            if (!interaction.guild) {
                console.log('[ERROR] This interaction doesn\'t have guild information');
                await this.followUp(replyInteraction, 'Command must be used in a server');
                return;
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
                    return;
                }

                const voiceChannel = member.voice.channel;
                console.log(`[DEBUG] Voice channel: ${voiceChannel.name} (${voiceChannel.id})`);

                // Check bot's permissions
                const me = guild.members.me;
                if (!me) {
                    console.log('[ERROR] Bot member not found in guild');
                    await this.followUp(replyInteraction, 'Bot configuration error. Please try again later.');
                    return;
                }

                const permissions = voiceChannel.permissionsFor(me);
                if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
                    console.log('[ERROR] Missing voice permissions');
                    await this.followUp(replyInteraction, 'I need permissions to join and speak in your voice channel!');
                    return;
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
                    selfMute: false
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
                    return;
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
                    return;
                }

                // Get the volume for this guild (default if not set)
                const volume = this.volumes.get(guild.id) || this.DEFAULT_VOLUME;
                console.log(`[DEBUG] Using volume level: ${volume}`);

                // Create and play audio resource with volume
                console.log('[DEBUG] Creating audio resource');
                const resource = createAudioResource(stream, {
                    inlineVolume: true
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

                player.on(AudioPlayerStatus.Idle, () => {
                    if (interaction.guildId) {
                        this.currentlyPlaying.delete(interaction.guildId);
                    }
                    console.log('[DEBUG] Player is idle - playback completed');
                    connection.destroy();
                    this.connections.delete(guild.id);
                    this.players.delete(guild.id);
                    this.resources.delete(guild.id);
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

            } catch (memberError) {
                console.error('[ERROR] Member fetch error:', memberError);
                await this.followUp(replyInteraction, 'Failed to get your user information. Please try again.');
            }

        } catch (error) {
            console.error('[ERROR] Unexpected error:', error);
            await this.followUp(replyInteraction, 'There was an unexpected error. Please try again later.');
        }
    }

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


    static getVolume(guildId: string): number {
        // Return volume as percentage (0-100)
        return (this.volumes.get(guildId) || this.DEFAULT_VOLUME) * 100;
    }
    static getCurrentlyPlaying(guildId: string): SongInfo | null {
        return this.currentlyPlaying.get(guildId) || null;
    }

}