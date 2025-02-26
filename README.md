# MapleSounds - MapleStory BGM Discord Bot

A Discord bot that brings the nostalgic background music (BGM) from MapleStory to your Discord server. Built with Discord.js and TypeScript, this bot allows users to play, manage, and favorite MapleStory BGM tracks directly in voice channels.

## Features

- **Play MapleStory BGM**: Stream MapleStory background music in Discord voice channels
- **Favorites System**: Save and manage your favorite BGM tracks
- **Playlist Management**: Create and manage BGM playlists
- **Volume Control**: Adjust the playback volume
- **User Data Persistence**: Save user preferences and favorites

## Commands

- `/maplebgm` - Play a MapleStory BGM track
- `/favoritebgm` - Add or remove a BGM track from favorites
- `/favoritesbgm` - View your favorite BGM tracks
- `/playlistbgm` - Manage BGM playlists
- `/stopbgm` - Stop the current BGM playback
- `/volumebgm` - Adjust the playback volume

## Project Structure

```
src/
├── commands/           # Discord slash commands
├── data/              # User data storage
├── handlers/          # Command and interaction handlers
├── services/          # API and user data services
├── utils/            # Utility functions and voice management
├── deploy-commands.ts # Command deployment script
└── index.ts          # Main application entry point
```

## Technical Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Main Dependencies**:
  - discord.js (v14)
  - @discordjs/voice
  - @discordjs/opus
  - axios
  - dotenv
  - ffmpeg-static
  - libsodium-wrappers

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hansjm10/MapleSounds.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Discord bot token:
   ```
   DISCORD_TOKEN=your_token_here
   CLIENT_ID=your_client_id_here
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Deploy commands to Discord:
   ```bash
   npm run deploy-commands
   ```

6. Start the bot:
   ```bash
   npm start
   ```

## Development

For development, you can use:
```bash
npm run dev
```

This will run the bot using ts-node, which allows for direct TypeScript execution without the need to compile first.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is using the dependencies' respective licenses. Please check each dependency's license terms in the package.json file.

---

*Note: MapleStory and its BGM are properties of Nexon. This bot is a fan project and is not affiliated with or endorsed by Nexon.*