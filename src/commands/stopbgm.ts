// src/commands/stopbgm.ts - Updated with embeds
import type { CommandInteraction, ColorResolvable } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { VoiceManager } from '../utils/voiceManager';

export class StopbgmCommand {
    data = new SlashCommandBuilder()
        .setName('stopbgm')
        .setDescription('Stop playing Maplestory BGM');

    async execute(interaction: CommandInteraction): Promise<void> {
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.reply('This command can only be used in a server.');
            return;
        }

        const stopped = VoiceManager.stopPlayback(guildId);

        if (stopped) {
            const stoppedEmbed = new EmbedBuilder()
                .setColor('#FF6961' as ColorResolvable)
                .setTitle('🛑 BGM Playback Stopped')
                .setDescription('Successfully stopped the BGM and disconnected from the voice channel.')
                .setFooter({ text: 'Use /maplebgm to play another song' })
                .setTimestamp();

            await interaction.reply({ embeds: [stoppedEmbed] });
        } else {
            const notPlayingEmbed = new EmbedBuilder()
                .setColor('#A9A9A9' as ColorResolvable)
                .setTitle('ℹ️ No BGM Playing')
                .setDescription('There is no BGM currently playing.')
                .setFooter({ text: 'Use /maplebgm to play a song' });

            await interaction.reply({ embeds: [notPlayingEmbed] });
        }
    }
}
