// src/commands/favoritebgm.ts

import {
    CommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ColorResolvable,
} from 'discord.js';
import { UserDataService } from '../services/userDataService';
import { VoiceManager } from '../utils/voiceManager';

export class FavoritebgmCommand {
    private userDataService: UserDataService;

    constructor() {
        this.userDataService = new UserDataService();
    }

    data = new SlashCommandBuilder()
        .setName('favoritebgm')
        .setDescription('Favorite the currently playing Maplestory BGM');

    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.guildId) {
            await interaction.followUp('This command must be used in a server.');
            return;
        }

        // Get the currently playing BGM
        const currentBgm = VoiceManager.getCurrentlyPlaying(interaction.guildId);

        if (!currentBgm) {
            await interaction.followUp('There is no BGM currently playing.');
            return;
        }

        // Add to favorites
        const success = this.userDataService.addToFavorites(
            interaction.user.id,
            currentBgm
        );

        if (success) {
            const embed = new EmbedBuilder()
                .setColor('#FFD700' as ColorResolvable)
                .setTitle('⭐ BGM Added to Favorites')
                .setDescription(`**${currentBgm.mapName}** (${currentBgm.streetName}) has been added to your favorites!`)
                .setThumbnail('https://i.imgur.com/nGyPbIj.png')
                .setFooter({ text: 'Use /favorites to see your favorite BGMs' });

            await interaction.followUp({ embeds: [embed] });
        } else {
            await interaction.followUp('This BGM is already in your favorites!');
        }
    }
}