// src/handlers/interactionHandler.ts
import {
    Interaction,
    CommandInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    Collection,
    EmbedBuilder,
    ColorResolvable,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType
} from 'discord.js';
import { SongInfo } from '../services/userDataService';
import { MusicCollectionService } from '../services/musicCollectionService';
import { MapleApiService } from '../services/mapleApi';
import { VoiceManager } from '../utils/voiceManager';
import { Readable } from 'stream';

export class InteractionHandler {
    private commands: Collection<string, any>;
    private musicService: MusicCollectionService;
    private mapleApi: MapleApiService;

    constructor(commands: Collection<string, any>) {
        this.commands = commands;
        this.musicService = MusicCollectionService.getInstance();
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

        // Playlist and favorite management
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
        // Queue management
        else if (customId === 'queue_shuffle' || customId === 'queue_skip' || customId === 'queue_clear' || customId === 'queue_show') {
            // These buttons are handled in their respective command collectors
            // We just acknowledge the interaction here to prevent timeouts
            await interaction.deferUpdate();
        } 
        // Direct play/queue from search results
        else if (customId.startsWith('play_selected_')) {
            const mapId = parseInt(customId.replace('play_selected_', ''));
            await this.handlePlaySelected(interaction, mapId);
        } else if (customId.startsWith('queue_selected_')) {
            const mapId = parseInt(customId.replace('queue_selected_', ''));
            await this.handleQueueSelected(interaction, mapId);
        }
        // Handle favorite and playlist buttons
        else if (customId.startsWith('favorite_map_')) {
            const mapId = parseInt(customId.replace('favorite_map_', ''));
            await this.handleAddMapToFavorites(interaction, mapId);
        } else if (customId.startsWith('add_to_playlist_')) {
            const mapId = parseInt(customId.replace('add_to_playlist_', ''));
            await this.handleAddMapToPlaylist(interaction, mapId);
        }
    }

    // Playlist and favorite handling methods
    private async handleRandomFavorite(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply();

        const randomSong = this.musicService.getRandomFavorite(interaction.user.id);

        if (!randomSong) {
            await interaction.followUp('You have no favorite BGMs saved.');
            return;
        }

        // Play the song - we already deferred the reply
        await this.musicService.playSongFromInfo(interaction, randomSong, true);
    }

    private async handlePlayPlaylist(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferReply();

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist || playlist.songs.length === 0) {
            await interaction.followUp('This playlist is empty or does not exist.');
            return;
        }

        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        // Clear existing queue first
        VoiceManager.clearQueue(interaction.guildId);

        // Add all songs to the queue
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

        // Play the first song
        await this.musicService.playSongFromInfo(interaction, playlist.songs[0], true);
        
        await interaction.followUp({
            content: `Added ${playlist.songs.length - 1} more songs from the playlist to the queue!`
        });
    }

    private async handleShufflePlaylist(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferReply();

        const playlist = this.musicService.getPlaylist(interaction.user.id, playlistName);

        if (!playlist || playlist.songs.length === 0) {
            await interaction.followUp('This playlist is empty or does not exist.');
            return;
        }

        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        // Clear existing queue first
        VoiceManager.clearQueue(interaction.guildId);

        // Create a shuffled copy of the playlist songs
        const shuffledSongs = [...playlist.songs];
        
        // Fisher-Yates shuffle algorithm
        for (let i = shuffledSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledSongs[i], shuffledSongs[j]] = [shuffledSongs[j], shuffledSongs[i]];
        }

        // Add all songs (except the first) to the queue in shuffled order
        for (let i = 1; i < shuffledSongs.length; i++) {
            const song = shuffledSongs[i];
            await VoiceManager.addToQueue(
                interaction.guildId,
                song.mapId,
                song.mapName,
                song.streetName,
                song.region,
                song.version
            );
        }

        // Play the first shuffled song immediately
        await this.musicService.playSongFromInfo(interaction, shuffledSongs[0], true);
        
        await interaction.followUp({
            content: `Added ${shuffledSongs.length - 1} more songs from the shuffled playlist to the queue!`
        });
    }

    private async handleConfirmDelete(interaction: ButtonInteraction, playlistName: string): Promise<void> {
        await interaction.deferUpdate();

        const success = this.musicService.deletePlaylist(
            interaction.user.id,
            playlistName
        );

        if (success) {
            const deleteEmbed = this.musicService.createBaseEmbed('🗑️ Playlist Deleted')
                .setColor('#FF0000' as ColorResolvable)
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

        const cancelEmbed = this.musicService.createBaseEmbed('✖️ Deletion Canceled')
            .setColor('#808080' as ColorResolvable)
            .setDescription(`Your playlist has not been deleted.`)
            .setFooter({ text: 'Your playlist is safe!' });

        await interaction.followUp({
            embeds: [cancelEmbed]
        });
    }

    // New handlers for play/queue from search results
    private async handlePlaySelected(interaction: ButtonInteraction, mapId: number): Promise<void> {
        await interaction.deferReply();

        try {
            if (!interaction.guildId) {
                await interaction.followUp('This command must be used in a server.');
                return;
            }

            // Get map info
            const mapInfo = await this.mapleApi.getMapInfo(mapId);
            if (!mapInfo) {
                await interaction.followUp('Could not find information for this map.');
                return;
            }

            // Get the BGM stream
            const stream = await this.mapleApi.getMapBgmStream(mapId);
            if (!stream) {
                await interaction.followUp(`Unable to play the BGM for "${mapInfo.name}". The song might not be available.`);
                return;
            }

            // Play BGM in voice channel
            const success = await VoiceManager.playAudioInChannel(
                interaction,
                stream,
                `${mapInfo.name} (${mapInfo.streetName})`,
                mapId,
                interaction
            );

            if (success) {
                // Create a "now playing" embed
                const mapImageUrl = this.mapleApi.getMapImageUrl(mapId);
                const nowPlayingEmbed = this.musicService.createBaseEmbed(`🎵 Now Playing: ${mapInfo.name}`)
                    .setColor('#00FF00' as ColorResolvable)
                    .setDescription(`**Location:** ${mapInfo.streetName}\n**Map ID:** ${mapId}`)
                    .addFields(
                        { name: 'Volume', value: `${VoiceManager.getVolume(interaction.guildId)}%`, inline: true },
                        { name: 'Controls', value: 'Use `/stopbgm` to stop playback\nUse `/volumebgm` to adjust volume', inline: true },
                        { name: 'Save', value: 'Use the buttons below to save this song', inline: true }
                    )
                    .setImage(mapImageUrl);

                await interaction.followUp({
                    embeds: [nowPlayingEmbed]
                });
            } else {
                await interaction.followUp('There was an error playing the BGM. Make sure you\'re in a voice channel.');
            }
        } catch (error) {
            console.error('Error playing selected BGM:', error);
            await interaction.followUp('There was an error playing the selected BGM.');
        }
    }

    private async handleQueueSelected(interaction: ButtonInteraction, mapId: number): Promise<void> {
        await interaction.deferReply();

        try {
            if (!interaction.guildId) {
                await interaction.followUp('This command must be used in a server.');
                return;
            }

            // Get map info
            const mapInfo = await this.mapleApi.getMapInfo(mapId);
            if (!mapInfo) {
                await interaction.followUp('Could not find information for this map.');
                return;
            }

            // Add to queue
            const success = await VoiceManager.addToQueue(
                interaction.guildId,
                mapId,
                mapInfo.name,
                mapInfo.streetName,
                mapInfo.region,
                mapInfo.version
            );

            if (success) {
                // Get queue position
                const queuePosition = VoiceManager.getQueuePosition(interaction.guildId, mapId);
                const queueStatus = VoiceManager.isPlaying(interaction.guildId) ? 'in queue' : 'and will play now';
                
                const queueEmbed = this.musicService.createBaseEmbed('🎵 Added to Queue')
                    .setColor('#0099FF' as ColorResolvable)
                    .setDescription(`**${mapInfo.name}** has been added to the queue ${queueStatus}${queuePosition ? ` at position #${queuePosition}` : ''}!`)
                    .setThumbnail(this.mapleApi.getMapImageUrl(mapId, true));

                await interaction.followUp({
                    embeds: [queueEmbed]
                });
            } else {
                await interaction.followUp('Failed to add the song to the queue. Make sure you\'re in a voice channel.');
            }
        } catch (error) {
            console.error('Error adding selected BGM to queue:', error);
            await interaction.followUp('There was an error adding the selected BGM to the queue.');
        }
    }

    // New global handlers for favorite and playlist buttons
    private async handleAddMapToFavorites(interaction: ButtonInteraction, mapId: number): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get map info
            const mapInfo = await this.mapleApi.getMapInfo(mapId);
            if (!mapInfo) {
                await interaction.followUp({ content: 'Could not find information for this map.', ephemeral: true });
                return;
            }

            // Create the SongInfo object
            const songInfo: SongInfo = {
                mapId: mapInfo.id,
                mapName: mapInfo.name,
                streetName: mapInfo.streetName,
                region: mapInfo.region,
                version: mapInfo.version
            };

            // Add to favorites
            const success = this.musicService.addToFavorites(
                interaction.user.id,
                songInfo
            );

            if (success) {
                const embed = this.musicService.createBaseEmbed('⭐ Added to Favorites')
                    .setColor('#FFD700' as ColorResolvable)
                    .setDescription(`**${mapInfo.name}** has been added to your favorites!`)
                    .setFooter({ text: 'Use /favorites to view all your favorite BGMs' });

                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.followUp({ content: 'This map is already in your favorites!', ephemeral: true });
            }
        } catch (error) {
            console.error('Error adding map to favorites:', error);
            await interaction.followUp({ content: 'There was an error adding the map to your favorites.', ephemeral: true });
        }
    }

    private async handleAddMapToPlaylist(interaction: ButtonInteraction, mapId: number): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get map info
            const mapInfo = await this.mapleApi.getMapInfo(mapId);
            if (!mapInfo) {
                await interaction.followUp({ content: 'Could not find information for this map.', ephemeral: true });
                return;
            }

            // Get user's playlists
            const playlists = this.musicService.getPlaylists(interaction.user.id);

            if (playlists.length === 0) {
                // No playlists - prompt to create one
                const createEmbed = this.musicService.createBaseEmbed('📋 No Playlists Found')
                    .setColor('#FF9900' as ColorResolvable)
                    .setDescription('You don\'t have any playlists yet. Would you like to create one?')
                    .setFooter({ text: 'Click the button below to create a new playlist' });

                const createButton = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`create_playlist_for_${mapId}`)
                            .setLabel('Create New Playlist')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('➕')
                    );

                const createResponse = await interaction.followUp({
                    embeds: [createEmbed],
                    components: [createButton],
                    ephemeral: true
                });

                // Collector for create playlist button
                const createCollector = createResponse.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000
                });

                createCollector.on('collect', async (buttonInt: ButtonInteraction) => {
                    if (buttonInt.customId === `create_playlist_for_${mapId}`) {
                        await buttonInt.deferUpdate();
                        const playlistName = `My Playlist ${Date.now()}`;
                        
                        // Create the playlist
                        const success = this.musicService.createPlaylist(
                            buttonInt.user.id,
                            playlistName
                        );

                        if (success) {
                            // Add the map to the playlist
                            const songInfo: SongInfo = {
                                mapId: mapInfo.id,
                                mapName: mapInfo.name,
                                streetName: mapInfo.streetName,
                                region: mapInfo.region,
                                version: mapInfo.version
                            };

                            const addSuccess = this.musicService.addToPlaylist(
                                buttonInt.user.id,
                                playlistName,
                                songInfo
                            );

                            if (addSuccess) {
                                const successEmbed = this.musicService.createBaseEmbed('✅ Playlist Created & Map Added')
                                    .setColor('#00FF00' as ColorResolvable)
                                    .setDescription(`Created playlist **${playlistName}** and added **${mapInfo.name}** to it!`)
                                    .setFooter({ text: 'Use /playlist view to manage your playlists' });

                                await buttonInt.followUp({
                                    embeds: [successEmbed],
                                    ephemeral: true
                                });
                            }
                        } else {
                            await buttonInt.followUp({
                                content: `Error creating playlist. Please try a different name.`,
                                ephemeral: true
                            });
                        }
                    }
                });

                return;
            }

            // User has playlists - create a select menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_playlist_for_${mapId}`)
                .setPlaceholder('Select a playlist')
                .addOptions(
                    playlists.map(playlist => ({
                        label: playlist.name,
                        description: `Contains ${playlist.songs.length} songs`,
                        value: playlist.name,
                    }))
                );

            // Add an option to create a new playlist
            selectMenu.addOptions({
                label: '➕ Create New Playlist',
                description: 'Create a new playlist for this map',
                value: 'create_new_playlist'
            });

            const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            const selectEmbed = this.musicService.createBaseEmbed('📋 Select a Playlist')
                .setColor('#3498DB' as ColorResolvable)
                .setDescription(`Select a playlist to add **${mapInfo.name}** to:`)
                .setFooter({ text: 'Select from your existing playlists or create a new one' });

            const selectResponse = await interaction.followUp({
                embeds: [selectEmbed],
                components: [selectRow],
                ephemeral: true
            });

            // Collector for playlist selection
            const selectCollector = selectResponse.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
            });

            selectCollector.on('collect', async (selectInt: StringSelectMenuInteraction) => {
                await selectInt.deferUpdate();

                const selectedValue = selectInt.values[0];

                // Handle creating a new playlist
                if (selectedValue === 'create_new_playlist') {
                    const playlistName = `My Playlist ${Date.now()}`;
                    
                    // Create the playlist
                    const success = this.musicService.createPlaylist(
                        selectInt.user.id,
                        playlistName
                    );

                    if (success) {
                        // Add the map to the playlist
                        const songInfo: SongInfo = {
                            mapId: mapInfo.id,
                            mapName: mapInfo.name,
                            streetName: mapInfo.streetName,
                            region: mapInfo.region,
                            version: mapInfo.version
                        };

                        const addSuccess = this.musicService.addToPlaylist(
                            selectInt.user.id,
                            playlistName,
                            songInfo
                        );

                        if (addSuccess) {
                            const successEmbed = this.musicService.createBaseEmbed('✅ Playlist Created & Map Added')
                                .setColor('#00FF00' as ColorResolvable)
                                .setDescription(`Created playlist **${playlistName}** and added **${mapInfo.name}** to it!`)
                                .setFooter({ text: 'Use /playlist view to manage your playlists' });

                            await selectInt.followUp({
                                embeds: [successEmbed],
                                ephemeral: true
                            });
                        }
                    } else {
                        await selectInt.followUp({
                            content: `Error creating playlist. Please try a different name.`,
                            ephemeral: true
                        });
                    }
                    return;
                }

                // Add to existing playlist
                const songInfo: SongInfo = {
                    mapId: mapInfo.id,
                    mapName: mapInfo.name,
                    streetName: mapInfo.streetName,
                    region: mapInfo.region,
                    version: mapInfo.version
                };

                const addSuccess = this.musicService.addToPlaylist(
                    selectInt.user.id,
                    selectedValue,
                    songInfo
                );

                if (addSuccess) {
                    const successEmbed = this.musicService.createBaseEmbed('✅ Added to Playlist')
                        .setColor('#00FF00' as ColorResolvable)
                        .setDescription(`**${mapInfo.name}** has been added to your playlist **${selectedValue}**!`)
                        .setFooter({ text: 'Use /playlist view to manage your playlists' });

                    await selectInt.followUp({
                        embeds: [successEmbed],
                        ephemeral: true
                    });
                } else {
                    await selectInt.followUp({
                        content: `This map is already in your playlist "${selectedValue}".`,
                        ephemeral: true
                    });
                }
            });
        } catch (error) {
            console.error('Error in handleAddMapToPlaylist:', error);
            await interaction.followUp({ content: 'There was an error adding the map to a playlist.', ephemeral: true });
        }
    }
}