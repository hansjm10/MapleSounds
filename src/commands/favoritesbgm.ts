// src/commands/favoritesbgm.ts

import {
    CommandInteraction,
    SlashCommandBuilder,
} from 'discord.js';
import { MusicCollectionService } from '../services/musicCollectionService';

export class FavoritesbgmCommand {
    private musicService: MusicCollectionService;

    constructor() {
        this.musicService = MusicCollectionService.getInstance();
    }

    data = new SlashCommandBuilder()
        .setName('favorites')
        .setDescription('List your favorite Maplestory BGMs');

    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        const favorites = this.musicService.getFavorites(interaction.user.id);

        if (favorites.length === 0) {
            await interaction.followUp('You haven\'t favorited any BGMs yet. Use `/favoritebgm` while a song is playing to add it to your favorites!');
            return;
        }

        // Use the centralized service to create favorites display
        const { embed, row } = this.musicService.createFavoritesEmbed(interaction.user.id);

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }
}