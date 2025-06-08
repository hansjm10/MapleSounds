// src/commands/findbgm.ts

import type {
    StringSelectMenuInteraction,
    ColorResolvable,
    ButtonInteraction,
    ChatInputCommandInteraction } from 'discord.js';
import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import type { IMapInfo } from '../services/mapleApi';
import { MapleApiService } from '../services/mapleApi';
import type { ISongInfo } from '../services/userDataService';
import { MusicCollectionService } from '../services/musicCollectionService';

export class FindbgmCommand {
    private mapleApi: MapleApiService;
    private musicService: MusicCollectionService;

    constructor() {
        this.mapleApi = new MapleApiService();
        this.musicService = MusicCollectionService.getInstance();
    }

    // Command definition
    data = new SlashCommandBuilder()
        .setName('findbgm')
        .setDescription('Find MapleStory maps and save them to playlists without playing')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search term for Maplestory map')
                .setRequired(true),
        )
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Game region')
                .setRequired(false)
                .addChoices(
                    { name: 'GMS (Global)', value: 'gms' },
                    { name: 'KMS (Korea)', value: 'kms' },
                    { name: 'JMS (Japan)', value: 'jms' },
                    { name: 'CMS (China)', value: 'cms' },
                    { name: 'TMS (Taiwan)', value: 'tms' },
                    { name: 'MSEA (Southeast Asia)', value: 'sea' },
                ),
        )
        .addStringOption(option =>
            option.setName('version')
                .setDescription('Game version (default: 253)')
                .setRequired(false),
        );

    // Command execution
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        console.log(
            `[DEBUG] Find command started - Guild ID: ${interaction.guildId}, Channel ID: ${interaction.channelId}`,
        );

        const searchTerm = interaction.options.getString('search');
        if (!searchTerm) {
            await interaction.followUp('Please provide a search term for the map.');
            return;
        }

        // Get optional region and version parameters
        const region = interaction.options.getString('region') ?? 'gms'; // Default to GMS
        const version = interaction.options.getString('version') ?? '253'; // Default to 253

        // Create specific API instance with the provided region and version
        const apiService = new MapleApiService(region, version);

        // Search for maps
        console.log(`[DEBUG] Searching for maps with term: ${searchTerm} in ${region} v${version}`);
        const maps = await apiService.searchMaps(searchTerm);

        if (maps.length === 0) {
            await interaction.followUp(
                `No maps found for "${searchTerm}" in ${region.toUpperCase()} v${version}. ` +
                'Try a different search term or region.',
            );
            return;
        }

        console.log(`[DEBUG] Found ${maps.length} maps`);

        // Create a search results embed
        const searchEmbed = new EmbedBuilder()
            .setColor('#FFA500' as ColorResolvable)
            .setTitle('🔍 MapleStory Map Search')
            .setDescription(
                `Found ${maps.length} maps matching **"${searchTerm}"** in ${region.toUpperCase()} v${version}\n` +
                'Select one to view details or add to a playlist:',
            )
            .setThumbnail('https://i.imgur.com/nGyPbIj.png') // MapleStory logo
            .setFooter({ text: 'MapleStory BGM Finder | Select a map from the dropdown menu below' });

        // Create a select menu for maps
        const mapSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('find_map_select')
            .setPlaceholder('Select a map to view details')
            .addOptions(
                maps.slice(0, 25).map(map => ({
                    label: map.name,
                    description: `${map.streetName} (ID: ${map.id})`,
                    value: map.id.toString(),
                })),
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(mapSelectMenu);

        // Send initial message with select menu
        const response = await interaction.followUp({
            embeds: [searchEmbed],
            components: [row],
        });

        console.log(`[DEBUG] Response message created - Message ID: ${response.id}`);

        // Create a collector for the select menu interaction
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000,
        });

        collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
            console.log('[DEBUG] Select interaction received');

            // Defer the update to acknowledge the interaction
            await selectInteraction.deferUpdate();

            const selectedMapId = parseInt(selectInteraction.values[0], 10);
            const selectedMap = maps.find(map => map.id === selectedMapId);

            if (!selectedMap) {
                await interaction.followUp('Invalid map selection.');
                return;
            }

            console.log(`[DEBUG] Map selected: ${selectedMap.name} (ID: ${selectedMapId})`);

            try {
                // Get map details
                const mapImageUrl = apiService.getMapImageUrl(selectedMapId);

                // Create map details embed
                const detailsEmbed = new EmbedBuilder()
                    .setColor('#3498DB' as ColorResolvable)
                    .setTitle(`🗺️ ${selectedMap.name}`)
                    .setDescription(`**Location:** ${selectedMap.streetName}\n**Map ID:** ${selectedMapId}`)
                    .addFields(
                        { name: 'Region', value: selectedMap.region.toUpperCase(), inline: true },
                        { name: 'Version', value: selectedMap.version, inline: true },
                        { name: 'BGM Link', value: `[Download](https://maplestory.io/api/${selectedMap.region}/${selectedMap.version}/map/${selectedMapId}/bgm)`, inline: true },
                    )
                    .setImage(mapImageUrl)
                    .setTimestamp()
                    .setFooter({ text: 'Use the buttons below to save this map to a playlist or to favorites' });

                // Create action buttons
                const buttons = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`favorite_map_${selectedMapId}`)
                            .setLabel('Add to Favorites')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⭐'),
                        new ButtonBuilder()
                            .setCustomId(`add_to_playlist_${selectedMapId}`)
                            .setLabel('Add to Playlist')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('📋'),
                    );

                // Send the details and buttons
                const detailsResponse = await interaction.followUp({
                    embeds: [detailsEmbed],
                    components: [buttons],
                });

                // Create a button collector
                const buttonCollector = detailsResponse.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 180000, // 3 minutes
                });

                buttonCollector.on('collect', async (buttonInteraction: ButtonInteraction) => {
                    const customId = buttonInteraction.customId;

                    // Handle favorite button
                    if (customId === `favorite_map_${selectedMapId}`) {
                        await this.handleAddToFavorites(buttonInteraction, selectedMap);
                    }
                    // Handle add to playlist button
                    else if (customId === `add_to_playlist_${selectedMapId}`) {
                        await this.handleAddToPlaylist(buttonInteraction, selectedMap);
                    }
                });

            } catch (error) {
                console.error('Error displaying map details:', error);
                await interaction.followUp('There was an error displaying the map details.');
            } finally {
                collector.stop();
            }
        });

        // Collector end handler - used if user doesn't select anything
        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#808080' as ColorResolvable)
                    .setTitle('⏰ Selection Timed Out')
                    .setDescription('You did not select a map in time.')
                    .setFooter({ text: 'Please run the command again to search for maps' });

                try {
                    await interaction.followUp({
                        embeds: [timeoutEmbed],
                    });
                } catch (error) {
                    console.error('Error sending timeout message:', error);
                }
            }
        });
    }

    // Handle adding a map to favorites
    private async handleAddToFavorites(interaction: ButtonInteraction, map: IMapInfo): Promise<void> {
        await interaction.deferUpdate();

        const songInfo: ISongInfo = {
            mapId: map.id,
            mapName: map.name,
            streetName: map.streetName,
            region: map.region,
            version: map.version,
        };

        const success = this.musicService.addToFavorites(
            interaction.user.id,
            songInfo,
        );

        if (success) {
            const embed = this.musicService.createBaseEmbed('⭐ Added to Favorites')
                .setColor('#FFD700' as ColorResolvable)
                .setDescription(`**${map.name}** has been added to your favorites!`)
                .setFooter({ text: 'Use /favorites to view all your favorite BGMs' });

            await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
            await interaction.followUp({
                content: 'This map is already in your favorites!',
                ephemeral: true,
            });
        }
    }

    // Handle adding a map to playlist
    private async handleAddToPlaylist(interaction: ButtonInteraction, map: IMapInfo): Promise<void> {
        await interaction.deferUpdate();

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
                        .setCustomId(`create_playlist_for_${map.id}`)
                        .setLabel('Create New Playlist')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('➕'),
                );

            const createResponse = await interaction.followUp({
                embeds: [createEmbed],
                components: [createButton],
                ephemeral: true,
            });

            // Collector for create playlist button
            const createCollector = createResponse.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
            });

            createCollector.on('collect', async (buttonInt: ButtonInteraction) => {
                if (buttonInt.customId === `create_playlist_for_${map.id}`) {
                    // Show modal for playlist name
                    const _modal = {
                        title: 'Create Playlist',
                        custom_id: `create_playlist_modal_${map.id}`,
                        components: [{
                            type: 1,
                            components: [{
                                type: 4,
                                custom_id: 'playlist_name',
                                label: 'Playlist Name',
                                style: 1,
                                min_length: 1,
                                max_length: 50,
                                required: true,
                                placeholder: 'Enter a name for your new playlist',
                            }],
                        }],
                    };

                    // This would be implemented with a modal in a real implementation
                    // For now, create a default playlist name
                    await buttonInt.deferUpdate();
                    const playlistName = `My Playlist ${Date.now()}`;

                    // Create the playlist
                    const success = this.musicService.createPlaylist(
                        buttonInt.user.id,
                        playlistName,
                    );

                    if (success) {
                        // Add the map to the playlist
                        const songInfo: ISongInfo = {
                            mapId: map.id,
                            mapName: map.name,
                            streetName: map.streetName,
                            region: map.region,
                            version: map.version,
                        };

                        const addSuccess = this.musicService.addToPlaylist(
                            buttonInt.user.id,
                            playlistName,
                            songInfo,
                        );

                        if (addSuccess) {
                            const successEmbed = this.musicService.createBaseEmbed('✅ Playlist Created & Map Added')
                                .setColor('#00FF00' as ColorResolvable)
                                .setDescription(`Created playlist **${playlistName}** and added **${map.name}** to it!`)
                                .setFooter({ text: 'Use /playlist view to manage your playlists' });

                            await buttonInt.followUp({
                                embeds: [successEmbed],
                                ephemeral: true,
                            });
                        }
                    } else {
                        await buttonInt.followUp({
                            content: 'Error creating playlist. Please try a different name.',
                            ephemeral: true,
                        });
                    }
                }
            });

            return;
        }

        // User has playlists - create a select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_playlist_for_${map.id}`)
            .setPlaceholder('Select a playlist')
            .addOptions(
                playlists.map(playlist => ({
                    label: playlist.name,
                    description: `Contains ${playlist.songs.length} songs`,
                    value: playlist.name,
                })),
            );

        // Add an option to create a new playlist
        selectMenu.addOptions({
            label: '➕ Create New Playlist',
            description: 'Create a new playlist for this map',
            value: 'create_new_playlist',
        });

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);

        const selectEmbed = this.musicService.createBaseEmbed('📋 Select a Playlist')
            .setColor('#3498DB' as ColorResolvable)
            .setDescription(`Select a playlist to add **${map.name}** to:`)
            .setFooter({ text: 'Select from your existing playlists or create a new one' });

        const selectResponse = await interaction.followUp({
            embeds: [selectEmbed],
            components: [selectRow],
            ephemeral: true,
        });

        // Collector for playlist selection
        const selectCollector = selectResponse.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000,
        });

        selectCollector.on('collect', async (selectInt: StringSelectMenuInteraction) => {
            await selectInt.deferUpdate();

            const selectedValue = selectInt.values[0];

            // Handle creating a new playlist
            if (selectedValue === 'create_new_playlist') {
                // In a real implementation, we would use a modal here
                // For now, create a default playlist name
                const playlistName = `My Playlist ${Date.now()}`;

                // Create the playlist
                const success = this.musicService.createPlaylist(
                    selectInt.user.id,
                    playlistName,
                );

                if (success) {
                    // Add the map to the playlist
                    const songInfo: ISongInfo = {
                        mapId: map.id,
                        mapName: map.name,
                        streetName: map.streetName,
                        region: map.region,
                        version: map.version,
                    };

                    const addSuccess = this.musicService.addToPlaylist(
                        selectInt.user.id,
                        playlistName,
                        songInfo,
                    );

                    if (addSuccess) {
                        const successEmbed = this.musicService.createBaseEmbed('✅ Playlist Created & Map Added')
                            .setColor('#00FF00' as ColorResolvable)
                            .setDescription(`Created playlist **${playlistName}** and added **${map.name}** to it!`)
                            .setFooter({ text: 'Use /playlist view to manage your playlists' });

                        await selectInt.followUp({
                            embeds: [successEmbed],
                            ephemeral: true,
                        });
                    }
                } else {
                    await selectInt.followUp({
                        content: 'Error creating playlist. Please try a different name.',
                        ephemeral: true,
                    });
                }
                return;
            }

            // Add to existing playlist
            const songInfo: ISongInfo = {
                mapId: map.id,
                mapName: map.name,
                streetName: map.streetName,
                region: map.region,
                version: map.version,
            };

            const addSuccess = this.musicService.addToPlaylist(
                selectInt.user.id,
                selectedValue,
                songInfo,
            );

            if (addSuccess) {
                const successEmbed = this.musicService.createBaseEmbed('✅ Added to Playlist')
                    .setColor('#00FF00' as ColorResolvable)
                    .setDescription(`**${map.name}** has been added to your playlist **${selectedValue}**!`)
                    .setFooter({ text: 'Use /playlist view to manage your playlists' });

                await selectInt.followUp({
                    embeds: [successEmbed],
                    ephemeral: true,
                });
            } else {
                await selectInt.followUp({
                    content: `This map is already in your playlist "${selectedValue}".`,
                    ephemeral: true,
                });
            }
        });
    }
}
