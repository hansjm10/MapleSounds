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
    StringSelectMenuOptionBuilder, ChatInputCommandInteraction, Interaction,
} from 'discord.js';
import { UserDataService, SongInfo } from '../services/userDataService';
import { VoiceManager } from '../utils/voiceManager';
import { MapleApiService } from '../services/mapleApi';

export class PlaylistbgmCommand {
    private userDataService: UserDataService;
    private mapleApi: MapleApiService;

    constructor() {
        this.userDataService = new UserDataService();
        this.mapleApi = new MapleApiService();
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

        const success = this.userDataService.createPlaylist(
            interaction.user.id,
            playlistName
        );

        if (success) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00' as ColorResolvable)
                .setTitle('🎵 Playlist Created')
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
        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

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
        const success = this.userDataService.addToPlaylist(
            interaction.user.id,
            playlistName,
            currentBgm
        );

        if (success) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00' as ColorResolvable)
                .setTitle('🎵 Added to Playlist')
                .setDescription(`**${currentBgm.mapName}** has been added to your playlist **${playlistName}**!`)
                .setThumbnail('https://i.imgur.com/nGyPbIj.png')
                .setFooter({ text: `Your playlist now has ${playlist.songs.length + 1} songs` });

            await interaction.followUp({ embeds: [embed] });
        } else {
            await interaction.followUp('This BGM is already in your playlist!');
        }
    }

    private async handleListPlaylists(interaction: CommandInteraction): Promise<void> {
        const playlists = this.userDataService.getPlaylists(interaction.user.id);

        if (playlists.length === 0) {
            await interaction.followUp('You haven\'t created any playlists yet. Use `/playlist create` to create one!');
            return;
        }

        // Create embed to display playlists
        const embed = new EmbedBuilder()
            .setColor('#9B59B6' as ColorResolvable)
            .setTitle('🎵 Your MapleStory BGM Playlists')
            .setDescription(`You have ${playlists.length} playlist(s):`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setFooter({ text: 'Use /playlist view <name> to see the songs in a playlist' });

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

        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        if (playlist.songs.length === 0) {
            await interaction.followUp(`Your playlist "${playlistName}" is empty. Add songs using /playlist add.`);
            return;
        }

        // Create an embed to display the playlist
        const embed = new EmbedBuilder()
            .setColor('#3498DB' as ColorResolvable)
            .setTitle(`🎵 Playlist: ${playlist.name}`)
            .setDescription(`This playlist contains ${playlist.songs.length} songs:`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setFooter({ text: `Created: ${new Date(playlist.createdAt).toLocaleDateString()} | Updated: ${new Date(playlist.updatedAt).toLocaleDateString()}` });

        // Add each song as a field
        playlist.songs.forEach((song, index) => {
            embed.addFields({
                name: `${index + 1}. ${song.mapName}`,
                value: `${song.streetName} (ID: ${song.mapId})`,
                inline: true
            });
        });

        // Create buttons for playlist actions
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`play_playlist_${playlistName}`)
                    .setLabel('Play Playlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId(`shuffle_playlist_${playlistName}`)
                    .setLabel('Shuffle Play')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔀'),
                new ButtonBuilder()
                    .setCustomId(`delete_playlist_${playlistName}`)
                    .setLabel('Delete Playlist')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }

    private async handlePlayPlaylist(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        if (playlist.songs.length === 0) {
            await interaction.followUp(`Your playlist "${playlistName}" is empty. Add songs using /playlist add.`);
            return;
        }

        // Create a select menu to choose which song to play
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_song_to_play')
            .setPlaceholder('Select a song to play')
            .addOptions(
                playlist.songs.map((song, index) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${index + 1}. ${song.mapName}`)
                        .setDescription(song.streetName)
                        .setValue(`${song.mapId}`)
                )
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);

        // Create an embed for song selection
        const embed = new EmbedBuilder()
            .setColor('#00FF00' as ColorResolvable)
            .setTitle(`🎵 Play from Playlist: ${playlist.name}`)
            .setDescription(`Select a song to play from your playlist:`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setFooter({ text: 'Select a song from the dropdown menu below' });

        // Create a secondary row with a shuffle button
        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`shuffle_playlist_${playlistName}`)
                    .setLabel('Play Random Song')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔀')
            );

        const response = await interaction.followUp({
            embeds: [embed],
            components: [row, buttonRow]
        });

        // Set up collector for the song selection
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
        });

        collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
            // User selected a song to play
            await selectInteraction.deferUpdate();

            const mapId = Number(selectInteraction.values[0]);
            const selectedSong = playlist.songs.find(song => song.mapId === mapId);

            if (!selectedSong) {
                await interaction.followUp('Error: Song not found in playlist.');
                return;
            }

            // Play the selected song
            await this.playSong(interaction, selectInteraction, selectedSong);

            collector.stop();
        });

        // Collector end handler
        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#808080' as ColorResolvable)
                    .setTitle('⏰ Selection Timed Out')
                    .setDescription('You did not select a song in time.')
                    .setFooter({ text: 'Please run the command again to select a song' });

                try {
                    await interaction.followUp({
                        embeds: [timeoutEmbed],
                        components: []
                    });
                } catch (error) {
                    console.error('Error sending timeout message:', error);
                }
            }
        });
    }

    private async handleDeletePlaylist(interaction: CommandInteraction): Promise<void> {
        const playlistName = interaction.options.get('name')?.value as string;

        if (!playlistName) {
            await interaction.followUp('You must provide a playlist name.');
            return;
        }

        // Check if the playlist exists
        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        // Create a confirmation button
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_delete_${playlistName}`)
                    .setLabel('Confirm Delete')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✖️')
            );

        // Create a confirmation embed
        const embed = new EmbedBuilder()
            .setColor('#FF0000' as ColorResolvable)
            .setTitle('⚠️ Confirm Playlist Deletion')
            .setDescription(`Are you sure you want to delete your playlist **${playlistName}**?\nThis action cannot be undone.`)
            .addFields({
                name: 'Playlist Contents',
                value: playlist.songs.length === 0 ?
                    'This playlist is empty.' :
                    `This playlist contains ${playlist.songs.length} songs.`
            })
            .setFooter({ text: 'Click a button below to confirm or cancel' });

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

        if (!position || position < 1) {
            await interaction.followUp('You must provide a valid position (1 or higher).');
            return;
        }

        // Adjust position to 0-based index
        const index = position - 1;

        // Get the playlist
        const playlist = this.userDataService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist) {
            await interaction.followUp(`You don't have a playlist named "${playlistName}".`);
            return;
        }

        // Check if the position is valid
        if (index >= playlist.songs.length) {
            await interaction.followUp(`Invalid position. Your playlist only has ${playlist.songs.length} songs.`);
            return;
        }

        // Get the song to be removed for display
        const songToRemove = playlist.songs[index];

        // Remove the song
        const success = this.userDataService.removeFromPlaylist(
            interaction.user.id,
            playlistName,
            index
        );

        if (success) {
            const embed = new EmbedBuilder()
                .setColor('#FF9900' as ColorResolvable)
                .setTitle('🗑️ Song Removed from Playlist')
                .setDescription(`**${songToRemove.mapName}** has been removed from your playlist **${playlistName}**.`)
                .setFooter({ text: `Your playlist now has ${playlist.songs.length - 1} songs` });

            await interaction.followUp({ embeds: [embed] });
        } else {
            await interaction.followUp('There was an error removing the song from your playlist.');
        }
    }

    // Helper method to actually play a song - updated for new VoiceManager signature
    private async playSong(
        commandInteraction: CommandInteraction,
        menuInteraction: StringSelectMenuInteraction,
        song: SongInfo
    ): Promise<void> {
        try {
            // Send a loading message
            const loadingEmbed = new EmbedBuilder()
                .setColor('#3498DB' as ColorResolvable)
                .setTitle('🎵 Loading BGM...')
                .setDescription(`Preparing to play **${song.mapName}** (${song.streetName})`)
                .setFooter({ text: 'Please wait while I connect to voice and prepare the BGM' });

            await commandInteraction.followUp({
                embeds: [loadingEmbed]
            });

            // Get the BGM stream
            console.log(`[DEBUG] Requesting BGM stream for map ID: ${song.mapId}`);
            const stream = await this.mapleApi.getMapBgmStream(song.mapId);

            if (!stream) {
                await commandInteraction.followUp(`Unable to play the BGM for "${song.mapName}". The song might not be available.`);
                return;
            }

            // Create a "now playing" embed
            const mapImageUrl = this.mapleApi.getMapImageUrl(song.mapId);
            const nowPlayingEmbed = new EmbedBuilder()
                .setColor('#00FF00' as ColorResolvable)
                .setTitle(`🎵 Now Playing: ${song.mapName}`)
                .setDescription(`**Location:** ${song.streetName}\n**Map ID:** ${song.mapId}`)
                .addFields(
                    { name: 'Volume', value: `${VoiceManager.getVolume(commandInteraction.guildId!)}%`, inline: true },
                    { name: 'Controls', value: 'Use `/stopbgm` to stop playback\nUse `/volumebgm` to adjust volume', inline: true },
                    { name: 'Download', value: `Download the BGM [here](https://maplestory.io/api/${song.region}/${song.version}/map/${song.mapId}/bgm)`, inline: true }
                )
                .setImage(mapImageUrl)
                .setTimestamp()
                .setFooter({ text: 'MapleStory BGM Player | From your playlist' });

            // Play the audio in the voice channel - using the updated method signature
            await VoiceManager.playAudioInChannel(
                menuInteraction,
                stream,
                `${song.mapName} (${song.streetName})`,
                song.mapId,
                commandInteraction as unknown as Interaction
            );

            // Send the now playing embed
            await commandInteraction.followUp({
                embeds: [nowPlayingEmbed]
            });

        } catch (error) {
            console.error('Error playing BGM from playlist:', error);
            await commandInteraction.followUp('There was an error playing the BGM from your playlist.');
        }
    }
}