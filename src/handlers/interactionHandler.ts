// src/handlers/interactionHandler.ts
import {
    Interaction,
    CommandInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    Collection,
    EmbedBuilder,
    ColorResolvable
} from 'discord.js';
import { UserDataService, SongInfo } from '../services/userDataService';
import { VoiceManager } from '../utils/voiceManager';
import { MapleApiService } from '../services/mapleApi';
import { Readable } from 'stream';

export class InteractionHandler {
    private commands: Collection<string, any>;
    private userDataService: UserDataService;
    private mapleApi: MapleApiService;

    constructor(commands: Collection<string, any>) {
        this.commands = commands;
        this.userDataService = new UserDataService();
        this.mapleApi = new MapleApiService();
    }

    // Main handler method
    async handleInteraction(interaction: Interaction): Promise<void> {
        try {
            if (interaction.isCommand()) {
                await this.handleCommandInteraction(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                // Most menu interactions are handled within their respective command collectors
                // But we could add global handling here if needed
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (interaction.isRepliable()) {
                const replyContent = 'There was an error processing your interaction!';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: replyContent, ephemeral: true });
                } else {
                    await interaction.reply({ content: replyContent, ephemeral: true });
                }
            }
        }
    }

    // Command interaction handler
    private async handleCommandInteraction(interaction: CommandInteraction): Promise<void> {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
    }

    // Button interaction handler
    private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        const { customId } = interaction;

        if (customId === 'play_random_favorite') {
            await this.handleRandomFavorite(interaction);
        } else if (customId.startsWith('play_playlist_')) {
            const playlistName = customId.replace('play_playlist_', '');
            await this.handlePlayPlaylist(interaction, playlistName);
        } else if (customId.startsWith('shuffle_playlist_')) {
            const playlistName = customId.replace('shuffle_playlist_', '');
            await this.handleShufflePlaylist(interaction, playlistName);
        } else if (customId.startsWith('confirm_delete_')) {
            const playlistName = customId.replace('confirm_delete_', '');
            await this.handleConfirmDelete(interaction, playlistName);
        } else if (customId === 'cancel_delete') {
            await this.handleCancelDelete(interaction);
        }
    }

    // Helper for playing songs from button interactions
    private async playSongFromInfo(
        interaction: ButtonInteraction,
        song: SongInfo
    ): Promise<void> {
        try {
            await interaction.deferReply();

            // Send a loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor('#3498DB' as ColorResolvable)
                .setTitle('🎵 Loading BGM...')
                .setDescription(`Preparing to play **${song.mapName}** (${song.streetName})`)
                .setFooter({ text: 'Please wait while I connect to voice and prepare the BGM' });

            await interaction.followUp({
                embeds: [loadingEmbed]
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

    // Helper to play audio and send appropriate messages
    private async playAudio(
        interaction: ButtonInteraction,
        stream: Readable,
        song: SongInfo
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
                    { name: 'Download', value: `Download the BGM [here](https://maplestory.io/api/${song.region}/${song.version}/map/${song.mapId}/bgm)`, inline: true }
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
                interaction
            );

            // Send the now playing embed
            await interaction.followUp({
                embeds: [nowPlayingEmbed]
            });
        } catch (error) {
            console.error('Error in playAudio:', error);
            await interaction.followUp('There was an error playing the audio.');
        }
    }

    // Playlist and favorite handling methods
    private async handleRandomFavorite(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply();

        const favorites = this.userDataService.getFavorites(interaction.user.id);

        if (favorites.length === 0) {
            await interaction.followUp('You have no favorite BGMs saved.');
            return;
        }

        // Select a random favorite
        const randomSong = favorites[Math.floor(Math.random() * favorites.length)];

        // Play the song
        await this.playSongFromInfo(interaction, randomSong);
    }

    private async handlePlayPlaylist(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferReply();

        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist || playlist.songs.length === 0) {
            await interaction.followUp('This playlist is empty or does not exist.');
            return;
        }

        // Play the first song
        await this.playSongFromInfo(interaction, playlist.songs[0]);
    }

    private async handleShufflePlaylist(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferReply();

        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist || playlist.songs.length === 0) {
            await interaction.followUp('This playlist is empty or does not exist.');
            return;
        }

        // Select a random song
        const randomSong = playlist.songs[Math.floor(Math.random() * playlist.songs.length)];

        // Play the song
        await this.playSongFromInfo(interaction, randomSong);
    }

    private async handleConfirmDelete(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferUpdate();

        const success = this.userDataService.deletePlaylist(
            interaction.user.id,
            playlistName
        );

        if (success) {
            const deleteEmbed = new EmbedBuilder()
                .setColor('#FF0000' as ColorResolvable)
                .setTitle('🗑️ Playlist Deleted')
                .setDescription(`Your playlist **${playlistName}** has been deleted.`)
                .setFooter({ text: 'You can create a new playlist with /playlist create' });

            await interaction.followUp({
                embeds: [deleteEmbed]
            });
        } else {
            await interaction.followUp('There was an error deleting the playlist.');
        }
    }

    private async handleCancelDelete(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferUpdate();

        const cancelEmbed = new EmbedBuilder()
            .setColor('#808080' as ColorResolvable)
            .setTitle('✖️ Deletion Canceled')
            .setDescription(`Your playlist has not been deleted.`)
            .setFooter({ text: 'Your playlist is safe!' });

        await interaction.followUp({
            embeds: [cancelEmbed]
        });
    }
}