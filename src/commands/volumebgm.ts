import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import { VoiceManager } from '../utils/voiceManager';

export class VolumebgmCommand {
    data = new SlashCommandBuilder()
        .setName('volumebgm')
        .setDescription('Adjust the volume of the MapleStory BGM playback')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100),
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply('This command can only be used in a server.');
            return;
        }

        const volumeLevel = interaction.options.getInteger('level');

        if (volumeLevel === null) {
            await interaction.reply(`Current volume: ${VoiceManager.getVolume(guildId)}%`);
            return;
        }

        const success = VoiceManager.setVolume(guildId, volumeLevel);

        if (success) {
            await interaction.reply(`BGM volume set to ${volumeLevel}%`);
        } else {
            await interaction.reply(`Volume preference saved to ${volumeLevel}%, but no BGM is currently playing.`);
        }
    }
}
