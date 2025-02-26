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
import { SongInfo } from "../services/userDataService";
import { MapleApiService } from "../services/mapleApi";

export class VoiceManager {
    private static instance: VoiceManager;
    private static connections = new Map();
    private static players = new Map();
    private static resources = new Map();
    private static volumes = new Map<string, number>(); // Store volume levels per guild
    private static DEFAULT_VOLUME = 0.2; // 20% volume by default
    private static currentlyPlaying = new Map<string, SongInfo>();
    private static queues = new Map<string, SongInfo[]>(); // Store song queues per guild
    private static mapleApi = new MapleApiService(); // Instance for getting BGM streams

    private constructor() {}

    static getInstance(): VoiceManager {
        if (!VoiceManager.instance) {
            VoiceManager.instance = new VoiceManager();
        }
        return VoiceManager.instance;
    }

    async playBgm(
        guildId: string,
        member: GuildMember,
        bgmStream: Readable,
        songInfo: SongInfo
    ): Promise<boolean> {
        try {
            if (!member.voice.channel) {
                return false;
            }

            const voiceChannel = member.voice.channel;
            const permissions = voiceChannel.permissionsFor(member.guild.members.me!);

            if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
                return false;
            }

            // Clean up any existing connection
            const existingConnection = getVoiceConnection(guildId);
            if (existingConnection) {
                existingConnection.destroy();
                VoiceManager.connections.delete(guildId);
                VoiceManager.players.delete(guildId);
                VoiceManager.resources.delete(guildId);
            }

            // Create new connection
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: member.guild.voiceAdapterCreator as any,
                selfDeaf: false,
                selfMute: false
            });

            VoiceManager.connections.set(guildId, connection);

            // Wait for ready state
            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            } catch (error) {
                connection.destroy();
                VoiceManager.connections.delete(guildId);
                return false;
            }

            // Create audio player
            const player = createAudioPlayer();
            VoiceManager.players.set(guildId, player);

            // Subscribe connection to player
            const subscription = connection.subscribe(player);
            if (!subscription) {
                connection.destroy();
                VoiceManager.connections.delete(guildId);
                VoiceManager.players.delete(guildId);
                return false;
            }

            // Get the volume for this guild
            const volume = VoiceManager.volumes.get(guildId) || VoiceManager.DEFAULT_VOLUME;

            // Create and play audio resource with volume
            const resource = createAudioResource(bgmStream, {
                inlineVolume: true
            });

            resource.volume?.setVolume(volume);
            VoiceManager.resources.set(guildId, resource);
            player.play(resource);

            // Store as currently playing
            VoiceManager.currentlyPlaying.set(guildId, songInfo);

            // Set up event handlers
            player.on(AudioPlayerStatus.Playing, () => {
                console.log('[DEBUG] Player is now playing audio');
            });

            player.on(AudioPlayerStatus.Idle, async () => {
                VoiceManager.currentlyPlaying.delete(guildId);
                
                // Check if there are more songs in the queue
                const queue = VoiceManager.queues.get(guildId);
                if (queue && queue.length > 0) {
                    const nextSong = queue.shift()!;
                    VoiceManager.queues.set(guildId, queue);
                    try {
                        const stream = await VoiceManager.mapleApi.getMapBgmStream(nextSong.mapId);
                        await this.playBgm(guildId, member, stream, nextSong);
                    } catch (error) {
                        console.error(`Error playing next song in queue: ${error}`);
                        // Try to play the next song if this one fails
                        if (queue.length > 0) {
                            const nextSong = queue.shift()!;
                            VoiceManager.queues.set(guildId, queue);
                            try {
                                const stream = await VoiceManager.mapleApi.getMapBgmStream(nextSong.mapId);
                                await this.playBgm(guildId, member, stream, nextSong);
                            } catch (nextError) {
                                console.error(`Error playing next song: ${nextError}`);
                                this.cleanup(guildId);
                            }
                        } else {
                            this.cleanup(guildId);
                        }
                    }
                } else {
                    this.cleanup(guildId);
                }
            });

            player.on('error', (error) => {
                console.error('[ERROR] Player error:', error);
                this.cleanup(guildId);
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    this.cleanup(guildId);
                }
            });

            return true;
        } catch (error) {
            console.error('[ERROR] Error in playBgm:', error);
            return false;
        }
    }

    private cleanup(guildId: string): void {
        const connection = VoiceManager.connections.get(guildId);
        if (connection) {
            connection.destroy();
        }
        VoiceManager.connections.delete(guildId);
        VoiceManager.players.delete(guildId);
        VoiceManager.resources.delete(guildId);
        VoiceManager.currentlyPlaying.delete(guildId);
        VoiceManager.clearQueueForGuild(guildId);
    }

    static setQueueForGuild(guildId: string, songs: SongInfo[]): void {
        VoiceManager.queues.set(guildId, songs);
    }

    static getQueueForGuild(guildId: string): SongInfo[] {
        return VoiceManager.queues.get(guildId) || [];
    }

    static clearQueueForGuild(guildId: string): void {
        VoiceManager.queues.delete(guildId);
    }

    static stopPlayback(guildId: string): boolean {
        const player = VoiceManager.players.get(guildId);
        const connection = VoiceManager.connections.get(guildId);

        if (player && connection) {
            console.log(`[DEBUG] Stopping playback in guild ${guildId}`);
            player.stop();
            connection.destroy();
            VoiceManager.players.delete(guildId);
            VoiceManager.connections.delete(guildId);
            VoiceManager.resources.delete(guildId);
            VoiceManager.currentlyPlaying.delete(guildId);
            VoiceManager.clearQueueForGuild(guildId);
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
        VoiceManager.volumes.set(guildId, volumeDecimal);

        // Update the current playback if it exists
        const resource = VoiceManager.resources.get(guildId);
        if (resource?.volume) {
            resource.volume.setVolume(volumeDecimal);
            return true;
        }

        // If no active resource but we've stored the setting for next playback
        return VoiceManager.volumes.has(guildId);
    }

    static getVolume(guildId: string): number {
        // Return volume as percentage (0-100)
        return (VoiceManager.volumes.get(guildId) || VoiceManager.DEFAULT_VOLUME) * 100;
    }

    static getCurrentlyPlaying(guildId: string): SongInfo | null {
        return VoiceManager.currentlyPlaying.get(guildId) || null;
    }

    private static async followUp(interaction: Interaction, content: string) {
        if (interaction.isRepliable()) {
            await interaction.followUp(content);
        }
    }
}
