// src/commands/favoritesbgm.ts

import {
    CommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ColorResolvable,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { UserDataService } from '../services/userDataService';

export class FavoritesbgmCommand {
    private userDataService: UserDataService;

    constructor() {
        this.userDataService = new UserDataService();
    }

    data = new SlashCommandBuilder()
        .setName('favorites')
        .setDescription('List your favorite Maplestory BGMs');

    async execute(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        const favorites = this.userDataService.getFavorites(interaction.user.id);

        if (favorites.length === 0) {
            await interaction.followUp('You haven\'t favorited any BGMs yet. Use `/favoritebgm` while a song is playing to add it to your favorites!');
            return;
        }

        // Create embed to display favorites
        const embed = new EmbedBuilder()
            .setColor('#FFD700' as ColorResolvable)
            .setTitle('⭐ Your Favorite MapleStory BGMs')
            .setDescription(`You have ${favorites.length} favorite BGMs:`)
            .setThumbnail('https://i.imgur.com/nGyPbIj.png')
            .setFooter({ text: 'Click the button below to play a random BGM from your favorites' });

        // Add each favorite as a field in the embed
        favorites.forEach((song, index) => {
            embed.addFields({
                name: `${index + 1}. ${song.mapName}`,
                value: `${song.streetName} (ID: ${song.mapId})`,
                inline: true
            });
        });

        // Create a button to play a random favorite
        const playButton = new ButtonBuilder()
            .setCustomId('play_random_favorite')
            .setLabel('Play Random Favorite')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎵');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(playButton);

        await interaction.followUp({
            embeds: [embed],
            components: [row]
        });
    }
}