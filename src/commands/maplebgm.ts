// src/commands/maplebgm.ts

import {
    CommandInteraction,
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ComponentType,
    EmbedBuilder,
    ColorResolvable,
} from 'discord.js';
import { MapleApiService, MapInfo } from '../services/mapleApi';
import { VoiceManager } from '../utils/voiceManager';

export class MaplebgmCommand {
    private mapleApi: MapleApiService;

    constructor() {
        this.mapleApi = new MapleApiService();
    }

    // Command definition
    data = new SlashCommandBuilder()
        .setName('maplebgm')
        .setDescription('Play Maplestory BGM from a specific map')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search term for Maplestory map')
                .setRequired(true)
        );

    // Command execution
    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        console.log(`[DEBUG] Command started - Guild ID: ${interaction.guildId}, Channel ID: ${interaction.channelId}`);

        const searchTerm = interaction.options.get('search')?.value as string;
        if (!searchTerm) {
            await interaction.followUp('Please provide a search term for the map.');
            return;
        }

        // Search for maps
        console.log(`[DEBUG] Searching for maps with term: ${searchTerm}`);
        const maps = await this.mapleApi.searchMaps(searchTerm);

        if (maps.length === 0) {
            await interaction.followUp(`No maps found for "${searchTerm}". Try a different search term.`);
            return;
        }

        console.log(`[DEBUG] Found ${maps.length} maps`);

        // Create a search results embed
        const searchEmbed = new EmbedBuilder()
            .setColor('#FFA500' as ColorResolvable)
            .setTitle(`🔍 MapleStory Map Search`)
            .setDescription(`Found ${maps.length} maps matching **"${searchTerm}"**\nPlease select one to play its BGM:`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png') // MapleStory logo
            .setFooter({ text: 'MapleStory BGM Player | Select a map from the dropdown menu below' });

        // Create a select menu for maps
        const mapSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('map_select')
            .setPlaceholder('Select a map to play its BGM')
            .addOptions(
                maps.slice(0, 25).map(map => ({
                    label: map.name,
                    description: `${map.streetName} (ID: ${map.id})`,
                    value: map.id.toString(),
                }))
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
            console.log(`[DEBUG] Select interaction received`);

            // Defer the update to acknowledge the interaction
            await selectInteraction.deferUpdate();

            const selectedMapId = parseInt(selectInteraction.values[0]);
            const selectedMap = maps.find(map => map.id === selectedMapId);

            if (!selectedMap) {
                await interaction.followUp('Invalid map selection.');
                return;
            }

            console.log(`[DEBUG] Map selected: ${selectedMap.name} (ID: ${selectedMapId})`);

            try {
                // Send a loading message
                const loadingEmbed = new EmbedBuilder()
                    .setColor('#3498DB' as ColorResolvable)
                    .setTitle('🎵 Loading BGM...')
                    .setDescription(`Preparing to play music from **${selectedMap.name}** (${selectedMap.streetName})`)
                    .setFooter({ text: 'Please wait while I connect to voice and prepare the BGM' });

                const loadingMsg = await interaction.followUp({
                    embeds: [loadingEmbed],
                });
                const mapImageUrl = this.mapleApi.getMapImageUrl(selectedMapId);
                const nowPlayingEmbed = new EmbedBuilder()
                    .setColor('#00FF00' as ColorResolvable)
                    .setTitle(`🎵 Now Playing: ${selectedMap.name}`)
                    .setDescription(`**Location:** ${selectedMap.streetName}\n**Map ID:** ${selectedMap.id}`)
                    .addFields(
                        { name: 'Volume', value: `${VoiceManager.getVolume(interaction.guildId!)}%`, inline: true },
                        { name: 'Controls', value: 'Use `/stopbgm` to stop playback\nUse `/volumebgm` to adjust volume', inline: true },
                        { name: 'Download', value: `Download the BGM [here](https://maplestory.io/api/${selectedMap.region}/${selectedMap.version}/map/${selectedMapId}/bgm)`, inline: true }

                    )
                    .setImage(mapImageUrl)
                    .setTimestamp()
                    .setFooter({ text: 'MapleStory BGM Player | Enjoy the music!' });
                console.log(`[DEBUG] Sent loading message as new message`);
                await interaction.followUp({
                    embeds: [nowPlayingEmbed],
                });
                // Get the BGM stream
                console.log(`[DEBUG] Requesting BGM stream for map ID: ${selectedMapId}`);
                const stream = await this.mapleApi.getMapBgmStream(selectedMapId);

                if (!stream) {
                    await interaction.followUp(`The selected map "${selectedMap.name}" doesn't have a BGM.`);
                    return;
                }

                console.log(`[DEBUG] BGM stream obtained successfully`);

                // THIS IS THE KEY CHANGE: Pass the selectInteraction directly
                // which contains the guild and voice state information
                console.log(`[DEBUG] Starting audio playback`);
                await VoiceManager.playAudioInChannel(
                    selectInteraction,  // Pass the entire select interaction
                    stream,
                    `${selectedMap.name} (${selectedMap.streetName})`,
                    interaction // For reply messages
                );

                console.log(`[DEBUG] Audio playback started successfully`);

                // Send confirmation message
                await interaction.followUp({
                    content: `Now playing: ${selectedMap.name} (${selectedMap.streetName})`,
                });
                console.log(`[DEBUG] Sent confirmation message after playback`);

            } catch (error) {
                console.error('Error playing BGM:', error);
                await interaction.followUp('There was an error playing the BGM.');
            } finally {
                collector.stop();
                console.log(`[DEBUG] Collector stopped`);
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
                        embeds: [timeoutEmbed]
                    });
                } catch (error) {
                    console.error('Error sending timeout message:', error);
                }
            }
        });
    }
}