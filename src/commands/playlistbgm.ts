// src/commands/playlistbgm.ts

import {
    CommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ColorResolvable,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuInteraction,
    ButtonInteraction,
    ComponentType,
    StringSelectMenuOptionBuilder, 
    ChatInputCommandInteraction, 
    Interaction,
} from 'discord.js';
import { SongInfo } from '../services/userDataService';
import { VoiceManager } from '../utils/voiceManager';
import { MusicCollectionService } from '../services/musicCollectionService';

export class PlaylistbgmCommand {
    private musicService: MusicCollectionService;

    constructor() {
        this.musicService = MusicCollectionService.getInstance();
    }

    data = new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Manage your Maplestory BGM playlists')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name for your new playlist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add currently playing BGM to a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist to add the BGM to')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all your playlists')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View the contents of a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist to view')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play BGMs from one of your playlists')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist to play')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist to delete')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a song from a playlist')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist to remove from')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('position')
                        .setDescription('Position of the song to remove (1-based)')
                        .setRequired(true)
                        .setMinValue(1)
                )
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await this.handleCreatePlaylist(interaction);
                break;
            case 'add':
                await this.handleAddToPlaylist(interaction);
                break;
            case 'list':
                await this.handleListPlaylists(interaction);
                break;
            case 'view':
                await this.handleViewPlaylist(interaction);
                break;
            case 'play':
                await this.handlePlayPlaylist(interaction);
                break;
            case 'delete':
                await this.handleDeletePlaylist(interaction);
                break;
            case 'remove':
                await this.handleRemoveFromPlaylist(interaction);
                break;
            default:
                await interaction.followUp('Unknown subcommand.');
        }
    }

    private async handleCreatePlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a name for your playlist.');
            return;
        }

        const success = this.musicService.createPlaylist(
            interaction.user.id,
            playlistName
        );

        if (success) {
            const embed = this.musicService.createBaseEmbed('🎵 Playlist Created')
                .setColor('#00FF00' as ColorResolvable)
                .setDescription(`Your playlist **${playlistName}** has been created!`)
                .setFooter({ text: 'Use /playlist add to add BGMs to your playlist' });

            await interaction.followUp({ embeds: [embed] });
        } else {
            await interaction.followUp(`You already have a playlist named "${playlistName}". Please choose a different name.`);
        }
    }

    private async handleAddToPlaylist(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        // Check if the playlist exists
        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}". Create one first using /playlist create.`);
            return;
        }

        // Get currently playing song
        const currentBgm = VoiceManager.getCurrentlyPlaying(interaction.guildId);

        if (!currentBgm) {
            await interaction.followUp('There is no BGM currently playing.');
            return;
        }

        // Add to playlist
        const success = this.musicService.addToPlaylist(
            interaction.user.id,
            playlistName,
            currentBgm
        );

        if (success) {
            const embed = this.musicService.createBaseEmbed('🎵 Added to Playlist')
                .setColor('#00FF00' as ColorResolvable)
                .setDescription(`**${currentBgm.mapName}** has been added to your playlist **${playlistName}**!`)
                .setFooter({ text: `Your playlist now has ${playlist.songs.length + 1} songs` });

            await interaction.followUp({ embeds: [embed] });
        } else {
            await interaction.followUp('This BGM is already in your playlist!');
        }
    }

    private async handleListPlaylists(interaction: CommandInteraction): Promise<void> {
        const playlists = this.musicService.getPlaylists(interaction.user.id);

        if (playlists.length === 0) {
            await interaction.followUp('You haven\'t created any playlists yet. Use `/playlist create` to create one!');
            return;
        }

        // Create embed to display playlists
        const embed = this.musicService.createBaseEmbed('🎵 Your MapleStory BGM Playlists')
            .setColor('#9B59B6' as ColorResolvable)
            .setDescription(`You have ${playlists.length} playlist(s):`)
            .setFooter({ text: 'Use /playlist view <n> to see the songs in a playlist' });

        // Add each playlist as a field
        playlists.forEach((playlist, index) => {
            const createdDate = new Date(playlist.createdAt).toLocaleDateString();
            embed.addFields({
                name: `${index + 1}. ${playlist.name}`,
                value: `Contains ${playlist.songs.length} songs\nCreated: ${createdDate}`,
                inline: true
            });
        });

        // Create a row of buttons for managing playlists
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play_random_playlist')
                    .setLabel('Play Random Playlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎲'),
                new ButtonBuilder()
                    .setCustomId('select_playlist_to_view')
                    .setLabel('View a Playlist')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👁️')
            );

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }

    private async handleViewPlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        if (playlist.songs.length === 0) {
            await interaction.followUp(`Your playlist "${playlistName}" is empty. Add songs using /playlist add.`);
            return;
        }

        // Use the centralized service to create playlist embed
        const embed = this.musicService.createPlaylistEmbed(playlist);
        
        // Create action row using the centralized service
        const row = this.musicService.createPlaylistActionRow(playlistName);

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }

    private async handlePlayPlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        if (playlist.songs.length === 0) {
            await interaction.followUp(`Your playlist "${playlistName}" is empty. Add songs using /playlist add.`);
            return;
        }

        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        // Start playing the first song and queue the rest
        try {
            // Clear existing queue first
            VoiceManager.clearQueue(interaction.guildId);

            // Add all songs to the queue (except the first one, which we'll play directly)
            for (let i = 1; i < playlist.songs.length; i++) {
                const song = playlist.songs[i];
                await VoiceManager.addToQueue(
                    interaction.guildId,
                    song.mapId,
                    song.mapName,
                    song.streetName,
                    song.region,
                    song.version
                );
            }

            // Create a "starting playback" message
            await interaction.followUp(`Starting playback of playlist "${playlistName}"...`);
            
            // Play the first song 
            if (interaction.isButton()) {
                await this.musicService.playSongFromInfo(interaction, playlist.songs[0]);
            } else {
                // Create a status embed for playlist playback
                await interaction.followUp({
                    content: `Now playing the first song from "${playlistName}"`,
                    embeds: [
                        this.musicService.createBaseEmbed(`🎵 Now Playing from: ${playlistName}`)
                            .setDescription(`**${playlist.songs[0].mapName}** (${playlist.songs[0].streetName})`)
                    ]
                });
            }
            
            // Notify about queued songs
            if (playlist.songs.length > 1) {
                await interaction.followUp({
                    content: `Added ${playlist.songs.length - 1} more songs from the playlist to the queue!`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error playing playlist:', error);
            await interaction.followUp('There was an error playing the playlist.');
        }
    }

    private async handleDeletePlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        // Create confirmation message
        const embed = this.musicService.createBaseEmbed('🗑️ Delete Playlist?')
            .setColor('#FF0000' as ColorResolvable)
            .setDescription(`Are you sure you want to delete your playlist **${playlistName}**?\nThis action cannot be undone.`)
            .addFields({
                name: 'Playlist Details',
                value: `Contains ${playlist.songs.length} songs\nCreated: ${new Date(playlist.createdAt).toLocaleDateString()}`
            });

        // Create confirmation buttons using the centralized service
        const row = this.musicService.createDeleteConfirmRow(playlistName);

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }

    private async handleRemoveFromPlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;
        const position = interaction.options.get('position')?.value as number;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        if (!position) {
            await interaction.followUp('You must provide a position to remove.');
            return;
        }

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        if (position < 1 || position > playlist.songs.length) {
            await interaction.followUp(`Invalid position. The playlist has ${playlist.songs.length} songs.`);
            return;
        }

        // Store the song info before removing it
        const songToRemove = playlist.songs[position - 1];

        // Remove the song
        const success = this.musicService.removeFromPlaylist(
            interaction.user.id,
            playlistName,
            position - 1 // Convert to 0-based index
        );

        if (success) {
            const embed = this.musicService.createBaseEmbed('🗑️ Song Removed')
                .setColor('#FF0000' as ColorResolvable)
                .setDescription(`**${songToRemove.mapName}** has been removed from your playlist **${playlistName}**.`)
                .setFooter({ text: `Your playlist now has ${playlist.songs.length - 1} songs` });

            await interaction.followUp({
                embeds: [embed]
            });
        } else {
            await interaction.followUp('There was an error removing the song from your playlist.');
        }
    }
}