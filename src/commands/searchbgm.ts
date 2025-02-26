import {
    CommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ColorResolvable,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    ComponentType,
    ChatInputCommandInteraction
} from 'discord.js';
import { MapleApiService } from '../services/mapleApi';
import { UserDataService } from '../services/userDataService';
import { VoiceManager } from '../utils/voiceManager';

export class SearchbgmCommand {
    private mapleApi: MapleApiService;
    private userDataService: UserDataService;

    constructor() {
        this.mapleApi = new MapleApiService();
        this.userDataService = new UserDataService();
    }

    data = new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for MapleStory BGMs')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search term for BGM/map name')
                .setRequired(true)
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const searchTerm = interaction.options.getString('query', true);
        const searchResults = await this.mapleApi.searchMaps(searchTerm);

        if (searchResults.length === 0) {
            const noResultsEmbed = new EmbedBuilder()
                .setColor('#FF0000' as ColorResolvable)
                .setTitle('❌ No Results Found')
                .setDescription(`No BGMs found matching "${searchTerm}"`)
                .setFooter({ text: 'Try a different search term' });

            await interaction.followUp({ embeds: [noResultsEmbed] });
            return;
        }

        // Create embed with search results
        const resultsEmbed = new EmbedBuilder()
            .setColor('#00FF00' as ColorResolvable)
            .setTitle('🔍 BGM Search Results')
            .setDescription(`Found ${searchResults.length} BGMs matching "${searchTerm}"`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png');

        // Add up to 10 results as fields
        searchResults.slice(0, 10).forEach((map, index) => {
            resultsEmbed.addFields({
                name: `${index + 1}. ${map.name}`,
                value: `${map.streetName} (ID: ${map.id})`,
                inline: true
            });
        });

        // Create buttons for actions
        const buttons = searchResults.slice(0, 5).map((map, index) => 
            new ButtonBuilder()
                .setCustomId(`play_search_${map.id}`)
                .setLabel(`Play ${index + 1}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('▶️')
        );

        const addToPlaylistButtons = searchResults.slice(0, 5).map((map, index) => 
            new ButtonBuilder()
                .setCustomId(`add_to_playlist_${map.id}`)
                .setLabel(`Add ${index + 1} to Playlist`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕')
        );

        const buttonRows = [
            new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
            new ActionRowBuilder<ButtonBuilder>().addComponents(...addToPlaylistButtons)
        ];

        const response = await interaction.followUp({
            embeds: [resultsEmbed],
            components: buttonRows
        });

        // Set up collector for button interactions
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            const [action, type, mapId] = buttonInteraction.customId.split('_');
            const map = searchResults.find(m => m.id === Number(mapId));

            if (!map) {
                await buttonInteraction.reply({ content: 'Error: Map not found', ephemeral: true });
                return;
            }

            if (action === 'play') {
                // Play the selected BGM
                try {
                    const bgmStream = await this.mapleApi.getMapBgmStream(map.id);
                    const voiceManager = VoiceManager.getInstance();
                    
                    if (!interaction.guildId || !interaction.member || !('voice' in interaction.member)) {
                        await buttonInteraction.reply({ content: 'Error: Cannot play in DMs or invalid member type', ephemeral: true });
                        return;
                    }

                    const songInfo = {
                        mapId: map.id,
                        mapName: map.name,
                        streetName: map.streetName,
                        region: map.region,
                        version: map.version
                    };

                    const success = await voiceManager.playBgm(
                        interaction.guildId,
                        interaction.member,
                        bgmStream,
                        songInfo
                    );

                    if (success) {
                        await buttonInteraction.reply(`Now playing: ${map.name} (${map.streetName})`);
                    } else {
                        await buttonInteraction.reply({ content: 'Error: Failed to play BGM. Make sure you are in a voice channel.', ephemeral: true });
                    }
                } catch (error) {
                    await buttonInteraction.reply({ content: 'Error: Failed to play BGM', ephemeral: true });
                }
            } else if (action === 'add') {
                // Show playlist selection menu
                const playlists = this.userDataService.getPlaylists(buttonInteraction.user.id);
                
                if (playlists.length === 0) {
                    await buttonInteraction.reply({
                        content: 'You don\'t have any playlists yet. Create one using `/playlist create`',
                        ephemeral: true
                    });
                    return;
                }

                const playlistEmbed = new EmbedBuilder()
                    .setColor('#00FF00' as ColorResolvable)
                    .setTitle('📝 Select Playlist')
                    .setDescription(`Select a playlist to add "${map.name}"`)
                    .setThumbnail('https://i.imgur.com/nGyPbIj.png');

                const playlistButtons = playlists.slice(0, 5).map(playlist => 
                    new ButtonBuilder()
                        .setCustomId(`add_to_playlist_${playlist.name}_${map.id}`)
                        .setLabel(playlist.name)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('➕')
                );

                const playlistRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(...playlistButtons);

                await buttonInteraction.reply({
                    embeds: [playlistEmbed],
                    components: [playlistRow],
                    ephemeral: true
                });
            } else if (buttonInteraction.customId.startsWith('add_to_playlist_')) {
                const [, , playlistName, mapIdStr] = buttonInteraction.customId.split('_');
                const mapId = Number(mapIdStr);
                const map = searchResults.find(m => m.id === mapId);

                if (!map) {
                    await buttonInteraction.reply({ content: 'Error: Map not found', ephemeral: true });
                    return;
                }

                const success = this.userDataService.addToPlaylist(
                    buttonInteraction.user.id,
                    playlistName,
                    {
                        mapId: map.id,
                        mapName: map.name,
                        streetName: map.streetName,
                        region: map.region,
                        version: map.version
                    }
                );

                if (success) {
                    await buttonInteraction.reply({
                        content: `Added "${map.name}" to playlist "${playlistName}"`,
                        ephemeral: true
                    });
                } else {
                    await buttonInteraction.reply({
                        content: `This BGM is already in playlist "${playlistName}"`,
                        ephemeral: true
                    });
                }
            }
        });

        collector.on('end', async () => {
            // Disable all buttons after timeout
            const disabledButtons = buttonRows.map(row => {
                const newRow = new ActionRowBuilder<ButtonBuilder>();
                row.components.forEach(button => {
                    newRow.addComponents(
                        ButtonBuilder.from(button).setDisabled(true)
                    );
                });
                return newRow;
            });

            await response.edit({ components: disabledButtons });
        });
    }
}