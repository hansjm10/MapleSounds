// src/services/musicCollectionService.ts

import type { SongInfo, Playlist } from './userDataService';
import { UserDataService } from './userDataService';
import { VoiceManager } from '../utils/voiceManager';
import { MapleApiService } from './mapleApi';
import type {
    ButtonInteraction,
    ColorResolvable } from 'discord.js';
import {
    Interaction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import type { Readable } from 'stream';

/**
 * Service to centralize all music collection (favorites and playlists) related functionality
 * This service handles all the operations related to favorites and playlists
 * and provides a unified interface for commands to interact with these collections
 */
export class MusicCollectionService {
    private userDataService: UserDataService;
    private mapleApi: MapleApiService;
    private static instance: MusicCollectionService;

    private constructor() {
        this.userDataService = new UserDataService();
        this.mapleApi = new MapleApiService();
    }

    /**
     * Get the singleton instance of the service
     */
    public static getInstance(): MusicCollectionService {
        if (!MusicCollectionService.instance) {
            MusicCollectionService.instance = new MusicCollectionService();
        }
        return MusicCollectionService.instance;
    }

    // =============== Favorite Management ===============

    /**
     * Add a song to a user's favorites
     */
    public addToFavorites(userId: string, song: SongInfo): boolean {
        return this.userDataService.addToFavorites(userId, song);
    }

    /**
     * Remove a song from a user's favorites
     */
    public removeFromFavorites(userId: string, mapId: number): boolean {
        return this.userDataService.removeFromFavorites(userId, mapId);
    }

    /**
     * Get all favorites for a user
     */
    public getFavorites(userId: string): SongInfo[] {
        return this.userDataService.getFavorites(userId);
    }

    /**
     * Get a random favorite song for a user
     */
    public getRandomFavorite(userId: string): SongInfo | null {
        const favorites = this.getFavorites(userId);
        if (favorites.length === 0) {
            return null;
        }
        return favorites[Math.floor(Math.random() * favorites.length)];
    }

    /**
     * Create an embed to display favorites
     */
    public createFavoritesEmbed(userId: string): { embed: EmbedBuilder, row: ActionRowBuilder<ButtonBuilder> } {
        const favorites = this.getFavorites(userId);

        const embed = new EmbedBuilder()
            .setColor('#FFD700' as ColorResolvable)
            .setTitle('⭐ Your Favorite MapleStory BGMs')
            .setDescription(`You have ${favorites.length} favorite BGMs:`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setFooter({ text: 'Click the button below to play a random BGM from your favorites' });

        // Add each favorite as a field in the embed
        favorites.forEach((song, index) => {
            embed.addFields({
                name: `${index + 1}. ${song.mapName}`,
                value: `${song.streetName} (ID: ${song.mapId})`,
                inline: true,
            });
        });

        // Create a button to play a random favorite
        const playButton = new ButtonBuilder()
            .setCustomId('play_random_favorite')
            .setLabel('Play Random Favorite')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎵');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(playButton);

        return { embed, row };
    }

    // =============== Playlist Management ===============

    /**
     * Create a new playlist for a user
     */
    public createPlaylist(userId: string, playlistName: string): boolean {
        return this.userDataService.createPlaylist(userId, playlistName);
    }

    /**
     * Add a song to a user's playlist
     */
    public addToPlaylist(userId: string, playlistName: string, song: SongInfo): boolean {
        return this.userDataService.addToPlaylist(userId, playlistName, song);
    }

    /**
     * Remove a song from a user's playlist
     */
    public removeFromPlaylist(userId: string, playlistName: string, index: number): boolean {
        return this.userDataService.removeFromPlaylist(userId, playlistName, index);
    }

    /**
     * Get a specific playlist for a user
     */
    public getPlaylist(userId: string, playlistName: string): Playlist | null {
        return this.userDataService.getPlaylist(userId, playlistName);
    }

    /**
     * Get all playlists for a user
     */
    public getPlaylists(userId: string): Playlist[] {
        return this.userDataService.getPlaylists(userId);
    }

    /**
     * Delete a playlist for a user
     */
    public deletePlaylist(userId: string, playlistName: string): boolean {
        return this.userDataService.deletePlaylist(userId, playlistName);
    }

    /**
     * Create an embed for a playlist
     */
    public createPlaylistEmbed(playlist: Playlist): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor('#9B59B6' as ColorResolvable)
            .setTitle(`🎵 Playlist: ${playlist.name}`)
            .setDescription(`${playlist.songs.length} songs in this playlist`)
            .setFooter({
                text: `Created: ${new Date(playlist.createdAt).toLocaleDateString()} • Updated: ${new Date(playlist.updatedAt).toLocaleDateString()}`,
            });

        // Add songs as fields
        playlist.songs.forEach((song, index) => {
            embed.addFields({
                name: `${index + 1}. ${song.mapName}`,
                value: `${song.streetName} (ID: ${song.mapId})`,
                inline: true,
            });
        });

        return embed;
    }

    /**
     * Create playlist action buttons
     */
    public createPlaylistActionRow(playlistName: string): ActionRowBuilder<ButtonBuilder> {
        const playButton = new ButtonBuilder()
            .setCustomId(`play_playlist_${playlistName}`)
            .setLabel('Play')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️');

        const shuffleButton = new ButtonBuilder()
            .setCustomId(`shuffle_playlist_${playlistName}`)
            .setLabel('Shuffle')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔀');

        const deleteButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_${playlistName}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(playButton, shuffleButton, deleteButton);
    }

    /**
     * Create confirmation buttons for playlist deletion
     */
    public createDeleteConfirmRow(playlistName: string): ActionRowBuilder<ButtonBuilder> {
        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_${playlistName}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');

        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton, cancelButton);
    }

    // =============== Playback Related ===============

    /**
     * Play a song from song info
     * @param alreadyDeferred Set to true if interaction.deferReply() was already called
     */
    public async playSongFromInfo(
        interaction: ButtonInteraction,
        song: SongInfo,
        alreadyDeferred: boolean = false,
    ): Promise<void> {
        try {
            // Only defer if not already deferred
            if (!alreadyDeferred) {
                try {
                    await interaction.deferReply();
                } catch (error) {
                    console.log('[DEBUG] Interaction already deferred:', error);
                    // Interaction was already deferred, continue
                }
            }

            // Send a loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor('#3498DB' as ColorResolvable)
                .setTitle('🎵 Loading BGM...')
                .setDescription(`Preparing to play **${song.mapName}** (${song.streetName})`)
                .setFooter({ text: 'Please wait while I connect to voice and prepare the BGM' });

            await interaction.followUp({
                embeds: [loadingEmbed],
            });

            // Get the BGM stream
            console.log(`[DEBUG] Requesting BGM stream for map ID: ${song.mapId}`);
            const stream = await this.mapleApi.getMapBgmStream(song.mapId);

            if (!stream) {
                await interaction.followUp(`Unable to play the BGM for "${song.mapName}". The song might not be available.`);
                return;
            }

            // Play the audio in the voice channel
            await this.playAudio(interaction, stream, song);

        } catch (error) {
            console.error('Error playing BGM:', error);
            await interaction.followUp('There was an error playing the BGM.');
        }
    }

    /**
     * Play audio and send appropriate messages
     */
    private async playAudio(
        interaction: ButtonInteraction,
        stream: Readable,
        song: SongInfo,
    ): Promise<void> {
        try {
            // Create a "now playing" embed
            const mapImageUrl = this.mapleApi.getMapImageUrl(song.mapId);
            const nowPlayingEmbed = new EmbedBuilder()
                .setColor('#00FF00' as ColorResolvable)
                .setTitle(`🎵 Now Playing: ${song.mapName}`)
                .setDescription(`**Location:** ${song.streetName}\n**Map ID:** ${song.mapId}`)
                .addFields(
                    { name: 'Volume', value: `${VoiceManager.getVolume(interaction.guildId!)}%`, inline: true },
                    { name: 'Controls', value: 'Use `/stopbgm` to stop playback\nUse `/volumebgm` to adjust volume', inline: true },
                    { name: 'Download', value: `Download the BGM [here](https://maplestory.io/api/${song.region}/${song.version}/map/${song.mapId}/bgm)`, inline: true },
                )
                .setImage(mapImageUrl)
                .setTimestamp()
                .setFooter({ text: 'MapleStory BGM Player' });

            // Play the audio
            await VoiceManager.playAudioInChannel(
                interaction,
                stream,
                `${song.mapName} (${song.streetName})`,
                song.mapId,
                interaction,
            );

            // Send the now playing embed
            await interaction.followUp({
                embeds: [nowPlayingEmbed],
            });
        } catch (error) {
            console.error('Error in playAudio:', error);
            await interaction.followUp('There was an error playing the audio.');
        }
    }

    /**
     * Create a base embed with standard styling
     */
    public createBaseEmbed(title: string): EmbedBuilder {
        return new EmbedBuilder()
            .setColor('#3498DB' as ColorResolvable)
            .setTitle(title)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setTimestamp()
            .setFooter({ text: 'MapleStory BGM Player' });
    }
}
