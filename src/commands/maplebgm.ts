// src/commands/maplebgm.ts

import type {
    StringSelectMenuInteraction,
    ColorResolvable,
    ChatInputCommandInteraction,
} from 'discord.js';
import {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ComponentType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import type { IMapInfo } from '../services/mapleApi';
import { MapleApiService } from '../services/mapleApi';
import { MusicCollectionService } from '../services/musicCollectionService';
import { VoiceManager } from '../utils/voiceManager';
import type { ISongInfo } from '../services/userDataService';

export class MaplebgmCommand {
    private mapleApi: MapleApiService;
    private musicService: MusicCollectionService;

    constructor() {
        this.mapleApi = new MapleApiService();
        this.musicService = MusicCollectionService.getInstance();
    }

    data = new SlashCommandBuilder()
        .setName('maplebgm')
        .setDescription('Play or add Maplestory BGM')
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
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What to do with the song')
                .setRequired(false)
                .addChoices(
                    { name: 'Play Now', value: 'play' },
                    { name: 'Add to Queue', value: 'queue' },
                    { name: 'Save Only', value: 'save' },
                ),
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const searchTerm = interaction.options.getString('search');
        const action = interaction.options.getString('action') ?? 'play'; // Default to play

        // Get optional region and version parameters
        const region = interaction.options.getString('region') ?? 'gms'; // Default to GMS
        const version = interaction.options.getString('version') ?? '253'; // Default to 253

        if (!searchTerm) {
            await interaction.followUp('Please provide a search term for the map.');
            return;
        }

        // Create specific API instance with the provided region and version
        const apiService = new MapleApiService(region, version);

        // Search for maps
        const maps = await apiService.searchMaps(searchTerm);

        if (maps.length === 0) {
            await interaction.followUp(
                `No maps found for "${searchTerm}" in ${region.toUpperCase()} v${version}. ` +
                'Try a different search term or region.',
            );
            return;
        }

        // Create a search results embed
        let embedTitle = '🔍 MapleStory BGM Search - ';
        let actionText = '';
        let embedColor: ColorResolvable = '#FFA500';

        if (action === 'play') {
            embedTitle += 'Play Now';
            actionText = 'play';
            embedColor = '#00FF00';
        } else if (action === 'queue') {
            embedTitle += 'Add to Queue';
            actionText = 'add to queue';
            embedColor = '#0099FF';
        } else {
            embedTitle += 'Save Only';
            actionText = 'view details';
        }

        const searchEmbed = this.musicService.createBaseEmbed(embedTitle)
            .setDescription(
                `Found ${maps.length} maps matching **"${searchTerm}"** in ${region.toUpperCase()} v${version}\n` +
                `Select one to ${actionText}:`,
            )
            .setColor(embedColor);

        // Create a select menu for maps
        const mapSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`map_select_${action}`)
            .setPlaceholder(`Select a map to ${actionText}`)
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

        // Create a collector for the select menu interaction
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000,
        });

        collector.on('collect', async (selectInteraction: StringSelectMenuInteraction) => {
            await selectInteraction.deferUpdate();

            const selectedMapId = parseInt(selectInteraction.values[0], 10);
            const selectedMap = maps.find(map => map.id === selectedMapId);

            if (!selectedMap) {
                await interaction.followUp('Invalid map selection.');
                return;
            }

            try {
                // Convert to ISongInfo format
                const songInfo: ISongInfo = {
                    mapId: selectedMap.id,
                    mapName: selectedMap.name,
                    streetName: selectedMap.streetName,
                    region: selectedMap.region,
                    version: selectedMap.version,
                };

                // Perform the selected action
                switch (action) {
                    case 'play':
                        await this.playNow(interaction, songInfo, apiService);
                        break;
                    case 'queue':
                        await this.addToQueue(interaction, songInfo, apiService);
                        break;
                    case 'save':
                        await this.showSaveOptions(interaction, selectedMap, apiService);
                        break;
                }

            } catch (error) {
                console.error('Error handling map selection:', error);
                await interaction.followUp('There was an error processing your selection.');
            } finally {
                collector.stop();
            }
        });

        // Handle collector end events
        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                try {
                    const timeoutEmbed = this.musicService.createBaseEmbed('⏰ Selection Timed Out')
                        .setDescription('You did not select a map in time.')
                        .setColor('#808080' as ColorResolvable);

                    await interaction.followUp({ embeds: [timeoutEmbed] });
                } catch (error) {
                    console.error('Error sending timeout message:', error);
                }
            }
        });
    }

    // Play the song now in voice channel
    private async playNow(
        interaction: ChatInputCommandInteraction,
        songInfo: ISongInfo,
        apiService: MapleApiService,
    ): Promise<void> {
        try {
            if (!interaction.guildId) {
                await interaction.followUp('This command must be used in a server.');
                return;
            }

            // Get the BGM stream
            const stream = await apiService.getMapBgmStream(songInfo.mapId);

            if (!stream) {
                await interaction.followUp(
                    `Unable to play the BGM for "${songInfo.mapName}". The song might not be available.`,
                );
                return;
            }

            // Play BGM in voice channel
            const success = await VoiceManager.playAudioInChannel(
                interaction,
                stream,
                `${songInfo.mapName} (${songInfo.streetName})`,
                songInfo.mapId,
                interaction,
            );

            if (success) {
                // Create a "now playing" embed
                const mapImageUrl = apiService.getMapImageUrl(songInfo.mapId);
                const nowPlayingEmbed = new EmbedBuilder()
                    .setColor('#00FF00' as ColorResolvable)
                    .setTitle(`🎵 Now Playing: ${songInfo.mapName}`)
                    .setDescription(`**Location:** ${songInfo.streetName}\n**Map ID:** ${songInfo.mapId}`)
                    .addFields(
                        { name: 'Region/Version', value: `${songInfo.region.toUpperCase()} v${songInfo.version}`, inline: true },
                        { name: 'Volume', value: `${VoiceManager.getVolume(interaction.guildId)}%`, inline: true },
                        { name: 'Controls', value: 'Use `/stopbgm` to stop playback\nUse `/volumebgm` to adjust volume', inline: true },
                    )
                    .setImage(mapImageUrl)
                    .setTimestamp();

                // Add action buttons
                const actionRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`favorite_map_${songInfo.mapId}`)
                            .setLabel('Add to Favorites')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⭐'),
                        new ButtonBuilder()
                            .setCustomId(`add_to_playlist_${songInfo.mapId}`)
                            .setLabel('Add to Playlist')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('📋'),
                    );

                await interaction.followUp({
                    embeds: [nowPlayingEmbed],
                    components: [actionRow],
                });
            } else {
                await interaction.followUp('There was an error playing the BGM. Make sure you\'re in a voice channel.');
            }
        } catch (error) {
            console.error('Error playing BGM:', error);
            await interaction.followUp('There was an error playing the BGM.');
        }
    }

    // Add the song to queue
    private async addToQueue(
        interaction: ChatInputCommandInteraction,
        songInfo: ISongInfo,
        apiService: MapleApiService,
    ): Promise<void> {
        try {
            if (!interaction.guildId) {
                await interaction.followUp('This command must be used in a server.');
                return;
            }

            // Add to queue
            const success = await VoiceManager.addToQueue(
                interaction.guildId,
                songInfo.mapId,
                songInfo.mapName,
                songInfo.streetName,
                songInfo.region,
                songInfo.version,
            );

            if (success) {
                // Get queue position
                const queuePosition = VoiceManager.getQueuePosition(interaction.guildId, songInfo.mapId);
                const queueStatus = VoiceManager.isPlaying(interaction.guildId) ? 'in queue' : 'and will play now';

                const queueEmbed = this.musicService.createBaseEmbed('🎵 Added to Queue')
                    .setColor('#0099FF' as ColorResolvable)
                    .setDescription(`**${songInfo.mapName}** (${songInfo.region.toUpperCase()} v${songInfo.version}) has been added to the queue ${queueStatus}${queuePosition ? ` at position #${queuePosition}` : ''}!`)
                    .setThumbnail(apiService.getMapImageUrl(songInfo.mapId, true));

                const actionRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('queue_show')
                            .setLabel('Show Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔍'),
                        new ButtonBuilder()
                            .setCustomId(`favorite_map_${songInfo.mapId}`)
                            .setLabel('Add to Favorites')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⭐'),
                    );

                await interaction.followUp({
                    embeds: [queueEmbed],
                    components: [actionRow],
                });
            } else {
                await interaction.followUp('Failed to add the song to the queue. Make sure you\'re in a voice channel.');
            }
        } catch (error) {
            console.error('Error adding to queue:', error);
            await interaction.followUp('There was an error adding the song to the queue.');
        }
    }

    // Show save options for the selected map
    private async showSaveOptions(
        interaction: ChatInputCommandInteraction,
        map: IMapInfo,
        apiService: MapleApiService,
    ): Promise<void> {
        // Get map details
        const mapImageUrl = apiService.getMapImageUrl(map.id);

        // Create map details embed
        const detailsEmbed = this.musicService.createBaseEmbed(`🗺️ ${map.name}`)
            .setColor('#FFA500' as ColorResolvable)
            .setDescription(`**Location:** ${map.streetName}\n**Map ID:** ${map.id}`)
            .addFields(
                { name: 'Region', value: map.region.toUpperCase(), inline: true },
                { name: 'Version', value: map.version, inline: true },
                { name: 'BGM Link', value: `[Download](https://maplestory.io/api/${map.region}/${map.version}/map/${map.id}/bgm)`, inline: true },
            )
            .setImage(mapImageUrl);

        // Create action buttons
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`play_selected_${map.id}`)
                    .setLabel('Play Now')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId(`queue_selected_${map.id}`)
                    .setLabel('Add to Queue')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId(`favorite_map_${map.id}`)
                    .setLabel('Add to Favorites')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⭐'),
                new ButtonBuilder()
                    .setCustomId(`add_to_playlist_${map.id}`)
                    .setLabel('Add to Playlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📋'),
            );

        await interaction.followUp({
            embeds: [detailsEmbed],
            components: [actionRow],
        });
    }
}
