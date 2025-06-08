// src/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { MaplebgmCommand } from './commands/maplebgm';
import { StopbgmCommand } from './commands/stopbgm';
import { VolumebgmCommand } from './commands/volumebgm';
import { FavoritebgmCommand } from './commands/favoritebgm';
import { FavoritesbgmCommand } from './commands/favoritesbgm';
import { PlaylistbgmCommand } from './commands/playlistbgm';
import { FindbgmCommand } from './commands/findbgm';
import { QueuebgmCommand } from './commands/queuebgm';
dotenv.config({ path: '../.env' });

const commands = [
    new MaplebgmCommand().data.toJSON(),
    new StopbgmCommand().data.toJSON(),
    new VolumebgmCommand().data.toJSON(),
    new FavoritebgmCommand().data.toJSON(),
    new FavoritesbgmCommand().data.toJSON(),
    new PlaylistbgmCommand().data.toJSON(),
    new FindbgmCommand().data.toJSON(),
    new QueuebgmCommand().data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN as string);

// Deploy commands function
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID as string),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
