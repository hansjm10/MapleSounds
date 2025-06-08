// src/index.ts
import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { MaplebgmCommand } from './commands/maplebgm';
import { StopbgmCommand } from './commands/stopbgm';
import { VolumebgmCommand } from './commands/volumebgm';
import { FavoritebgmCommand } from './commands/favoritebgm';
import { FavoritesbgmCommand } from './commands/favoritesbgm';
import { PlaylistbgmCommand } from './commands/playlistbgm';
import { FindbgmCommand } from './commands/findbgm';
import { QueuebgmCommand } from './commands/queuebgm';
import { InteractionHandler } from './handlers/interactionHandler';

dotenv.config({ path: '../.env' });

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Command collection
const commands: Collection<string, any> = new Collection();
commands.set('maplebgm', new MaplebgmCommand());
commands.set('stopbgm', new StopbgmCommand());
commands.set('volumebgm', new VolumebgmCommand());
commands.set('favoritebgm', new FavoritebgmCommand());
commands.set('favorites', new FavoritesbgmCommand());
commands.set('playlist', new PlaylistbgmCommand());
commands.set('findbgm', new FindbgmCommand());
commands.set('queuebgm', new QueuebgmCommand());

// Create interaction handler
const interactionHandler = new InteractionHandler(commands);

// When the client is ready, run this code
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle all interactions through the interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  await interactionHandler.handleInteraction(interaction);
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);
