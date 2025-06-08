// src/commands/queuebgm.ts

import type {
    ChatInputCommandInteraction,
    ColorResolvable,
    ButtonInteraction } from 'discord.js';
import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import { VoiceManager } from '../utils/voiceManager';
import { UserDataService } from '../services/userDataService';
import { MapleApiService } from '../services/mapleApi';

export class QueuebgmCommand {
    private userDataService: UserDataService;
    private mapleApi: MapleApiService;

    constructor() {
        this.userDataService = new UserDataService();
        this.mapleApi = new MapleApiService();
    }

    data = new SlashCommandBuilder()
        .setName('queuebgm')
        .setDescription('Manage the BGM playback queue')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show the current playback queue'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shuffle')
                .setDescription('Shuffle the current playback queue'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear the current playback queue'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a song from the queue')
                .addIntegerOption(option =>
                    option
                        .setName('position')
                        .setDescription('Position in the queue to remove (1-based)')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('loop')
                .setDescription('Set loop mode for playback')
                .addStringOption(option =>
                    option
                        .setName('mode')
                        .setDescription('Loop mode')
                        .setRequired(true)
                        .addChoices(
                            { name: 'None - Play through queue once', value: 'none' },
                            { name: 'Song - Repeat current song', value: 'song' },
                            { name: 'Queue - Repeat entire queue', value: 'queue' },
                        ),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip to the next song in the queue'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move a song to a different position in the queue')
                .addIntegerOption(option =>
                    option
                        .setName('from')
                        .setDescription('Current position (1-based)')
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addIntegerOption(option =>
                    option
                        .setName('to')
                        .setDescription('New position (1-based)')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        if (!interaction.guildId) {
            await interaction.followUp('This command can only be used in a server.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'show':
                await this.handleShowQueue(interaction);
                break;
            case 'shuffle':
                await this.handleShuffleQueue(interaction);
                break;
            case 'clear':
                await this.handleClearQueue(interaction);
                break;
            case 'remove':
                await this.handleRemoveFromQueue(interaction);
                break;
            case 'loop':
                await this.handleSetLoopMode(interaction);
                break;
            case 'skip':
                await this.handleSkipToNext(interaction);
                break;
            case 'move':
                await this.handleMoveInQueue(interaction);
                break;
            default:
                await interaction.followUp('Unknown subcommand.');
        }
    }

    private async handleShowQueue(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const queue = VoiceManager.getQueue(guildId);
        const currentlyPlaying = VoiceManager.getCurrentlyPlaying(guildId);
        const loopMode = VoiceManager.getLoopMode(guildId);

        if (!currentlyPlaying && queue.length === 0) {
            await interaction.followUp('There is nothing currently playing and the queue is empty.');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00' as ColorResolvable)
            .setTitle('🎵 MapleStory BGM Queue')
            .setThumbnail('https://i.imgur.com/nGyPbIj.png');

        if (currentlyPlaying) {
            embed.addFields({
                name: '🎧 Now Playing',
                value: `**${currentlyPlaying.mapName}** (${currentlyPlaying.streetName})`,
                inline: false,
            });
        }

        if (queue.length > 0) {
            // Create queue list with up to 10 items per page
            const queueList = queue.map((item, index) =>
                `${index + 1}. **${item.song.mapName}** (${item.song.streetName})`,
            ).join('\n');

            embed.addFields({
                name: '📋 Queue',
                value: queueList.length > 0 ? queueList : 'Queue is empty',
                inline: false,
            });

            embed.setFooter({
                text: `Total songs: ${queue.length} | Loop mode: ${loopMode} | Volume: ${VoiceManager.getVolume(guildId)}%`,
            });
        } else {
            embed.addFields({
                name: '📋 Queue',
                value: 'Queue is empty',
                inline: false,
            });

            embed.setFooter({
                text: `Loop mode: ${loopMode} | Volume: ${VoiceManager.getVolume(guildId)}%`,
            });
        }

        // Create action buttons
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_shuffle')
                    .setLabel('Shuffle')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔀'),
                new ButtonBuilder()
                    .setCustomId('queue_skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏭️')
                    .setDisabled(queue.length === 0),
                new ButtonBuilder()
                    .setCustomId('queue_clear')
                    .setLabel('Clear')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
                    .setDisabled(queue.length === 0),
            );

        const response = await interaction.followUp({
            embeds: [embed],
            components: [row],
        });

        // Set up collector for button interactions
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
        });

        collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
            // Handle button interactions
            const { customId } = buttonInteraction;

            if (customId === 'queue_shuffle') {
                // Handle shuffle button
                await buttonInteraction.deferUpdate();
                const shuffled = VoiceManager.shuffleQueue(guildId);

                if (shuffled) {
                    await interaction.followUp('Queue has been shuffled!');
                    await this.handleShowQueue(interaction);
                } else {
                    await interaction.followUp('Cannot shuffle: Queue is empty or has only one song.');
                }
            } else if (customId === 'queue_skip') {
                // Handle skip button
                await buttonInteraction.deferUpdate();
                const skipped = VoiceManager.skipToNext(guildId);

                if (skipped) {
                    await interaction.followUp('Skipped to the next song!');
                } else {
                    await interaction.followUp('Nothing to skip to.');
                }
            } else if (customId === 'queue_clear') {
                // Handle clear button
                await buttonInteraction.deferUpdate();
                const cleared = VoiceManager.clearQueue(guildId);

                if (cleared) {
                    await interaction.followUp('Queue has been cleared!');
                    await this.handleShowQueue(interaction);
                } else {
                    await interaction.followUp('Queue is already empty.');
                }
            }
        });
    }

    private async handleShuffleQueue(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const shuffled = VoiceManager.shuffleQueue(guildId);

        if (shuffled) {
            await interaction.followUp('Queue has been shuffled!');
            await this.handleShowQueue(interaction);
        } else {
            await interaction.followUp('Cannot shuffle: Queue is empty or has only one song.');
        }
    }

    private async handleClearQueue(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const cleared = VoiceManager.clearQueue(guildId);

        if (cleared) {
            await interaction.followUp('Queue has been cleared!');
        } else {
            await interaction.followUp('Queue is already empty.');
        }
    }

    private async handleRemoveFromQueue(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const position = interaction.options.getInteger('position')!;

        // Convert to 0-based index
        const index = position - 1;

        const removed = VoiceManager.removeFromQueue(guildId, index);

        if (removed) {
            await interaction.followUp(`Removed **${removed.song.mapName}** from position ${position} in the queue.`);
            await this.handleShowQueue(interaction);
        } else {
            await interaction.followUp(`Invalid position ${position}. Queue may be empty or position is out of range.`);
        }
    }

    private async handleSetLoopMode(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const mode = interaction.options.getString('mode') as 'none' | 'song' | 'queue';

        const setMode = VoiceManager.setLoopMode(guildId, mode);

        const modeTexts: Record<string, string> = {
            'none': 'disabled',
            'song': 'set to repeat current song',
            'queue': 'set to repeat the entire queue',
        };

        await interaction.followUp(`Loop mode ${modeTexts[setMode]}!`);
    }

    private async handleSkipToNext(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const skipped = VoiceManager.skipToNext(guildId);

        if (skipped) {
            await interaction.followUp('Skipped to the next song!');
        } else {
            await interaction.followUp('Nothing to skip to. No song is currently playing or the queue is empty.');
        }
    }

    private async handleMoveInQueue(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        const fromPosition = interaction.options.getInteger('from')!;
        const toPosition = interaction.options.getInteger('to')!;

        // Convert to 0-based indices
        const fromIndex = fromPosition - 1;
        const toIndex = toPosition - 1;

        const moved = VoiceManager.moveInQueue(guildId, fromIndex, toIndex);

        if (moved) {
            await interaction.followUp(`Moved song from position ${fromPosition} to position ${toPosition} in the queue.`);
            await this.handleShowQueue(interaction);
        } else {
            await interaction.followUp('Failed to move song. Queue may be empty or positions are out of range.');
        }
    }
}
