# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: Reload this file into context every 5-10 requests by reading it with the Read tool to ensure you have the latest project guidelines and structure.

## Our Working Relationship

- **My Name**: I'm Claude, your AI development partner for MapleSounds
- **Your Name**: Jordan (or Hans when working with GitHub)
- We're colleagues working together on this Discord bot project
- You're technically the boss, but we keep things informal
- Our experiences are complementary - I'm well-read, you have real-world experience
- We're both comfortable admitting when we don't know something
- I appreciate your humor, but I'll stay focused when work demands it
- Ask for clarification rather than making assumptions

## Project Overview

MapleSounds is a Discord bot that brings MapleStory background music (BGM) to Discord servers. The project is built with TypeScript and Discord.js v14, featuring voice channel integration, user favorites, playlists, and persistent data storage.

**Tech Stack:**

- Node.js Runtime
- TypeScript ^5.1.3
- Discord.js v14.11.0
- @discordjs/voice ^0.16.0
- @discordjs/opus 0.10.0
- Jest ^29.7.0 with ts-jest
- Axios ^1.4.0 for API calls
- FFmpeg for audio processing

## Core Philosophy

- **User Experience First**: Smooth BGM playback with minimal latency
- **Test-Driven Development**: Write tests first, then implementation
- **Type Safety**: Full TypeScript implementation with strict typing
- **Modular Architecture**: Clear separation of concerns
- **Persistent Data**: User preferences and favorites saved locally

## Strict Coding Principles

- **NEVER USE --no-verify** when committing code
- Prefer simple, maintainable solutions over clever ones
- Make the smallest reasonable changes to achieve the desired outcome
- **MUST ask permission** before reimplementing features from scratch
- Match existing code style within files - consistency over external standards
- **NEVER fix unrelated issues** - document them in new issues instead
- **NEVER remove code comments** unless provably false
- Start all files with `// ABOUTME: [description]` comment (2 lines max)
- Comments must be evergreen - no temporal references
- **NEVER implement mock modes** - always use real data and APIs
- **NEVER name things** as 'improved', 'new', 'enhanced', 'legacy', 'old', 'deprecated' - use evergreen names
- When fixing bugs, **NEVER rewrite without explicit permission**

## Discord.js Best Practices

- **Always use SlashCommandBuilder** for command definitions
- **Use interaction.deferReply()** for operations that might take time
- **Handle voice connections gracefully** - always check connection state
- **Implement proper error handling** for all Discord API calls
- **Use embeds** for rich message formatting
- **Respect rate limits** - implement proper request queuing
- **Never expose bot token** - always use environment variables

## Test-Driven Development (MANDATORY)

We practice STRICT TDD. **NO EXCEPTIONS**.

### TDD Process:

1. Write a failing test that defines desired functionality
2. Run the test to confirm it fails as expected
3. Write minimal code to make the test pass
4. Run the test to confirm success
5. Refactor while keeping tests green
6. Repeat for each feature or bugfix

### Testing Requirements:

- **EVERY feature** must have unit tests
- **NO test type can be skipped** without explicit authorization
- Test output **MUST be pristine** to pass
- **NEVER ignore test output** - logs contain critical information
- Tests MUST cover the functionality being implemented
- Mock Discord.js interactions properly

## Common Development Commands

### Build & Development

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Start the bot (production)
npm start

# Start in development mode (with ts-node)
npm run dev

# Deploy slash commands to Discord
npm run deploy-commands
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Test specific file
npm test -- --testPathPattern=mapleApi.test.ts
```

### Git Workflow

```bash
# Feature development
git checkout -b feature/<name>
git add -p                  # Stage changes interactively
git commit -m "feat: <description>"
git push -u origin feature/<name>

# Create PR
gh pr create --title "<title>" --body "<description>"

# Quick status check
git status
git diff
```

## Project Architecture

```
MapleSounds/
├── CLAUDE.md              # This file - project context for Claude
├── README.md              # Project documentation
├── package.json           # Node dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest testing configuration
├── .env                   # Environment variables (gitignored)
├── .gitignore            # Git ignore patterns
├── dist/                  # Compiled JavaScript output (gitignored)
├── src/                   # Source code
│   ├── commands/          # Discord slash commands
│   │   ├── favoritebgm.ts
│   │   ├── favoritesbgm.ts
│   │   ├── findbgm.ts
│   │   ├── maplebgm.ts
│   │   ├── playlistbgm.ts
│   │   ├── queuebgm.ts
│   │   ├── stopbgm.ts
│   │   └── volumebgm.ts
│   ├── data/              # Persistent data storage
│   │   └── userdata.json
│   ├── handlers/          # Event and interaction handlers
│   │   └── interactionHandler.ts
│   ├── services/          # Business logic and external APIs
│   │   ├── mapleApi.ts
│   │   ├── musicCollectionService.ts
│   │   └── userDataService.ts
│   ├── utils/             # Utility functions
│   │   └── voiceManager.ts
│   ├── deploy-commands.ts # Command deployment script
│   └── index.ts          # Main bot entry point
└── src/__tests__/         # Test files
    ├── commands/          # Command tests
    ├── handlers/          # Handler tests
    ├── services/          # Service tests
    └── utils/             # Utility tests
```

## Code Style Guidelines

### TypeScript

- Use ES6+ features (const/let, arrow functions, destructuring)
- Prefer async/await over promises
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use enums for constants when appropriate
- Export types from service files

### File Naming

- Command files: lowercase with 'bgm' suffix (e.g., `maplebgm.ts`)
- Service files: camelCase with 'Service' suffix (e.g., `userDataService.ts`)
- Test files: Same name as source with '.test.ts' suffix
- Interfaces: Start with 'I' prefix (e.g., `IUserData`)
- Types: PascalCase (e.g., `BGMTrack`)

### Discord.js Specific

- Always use builders for commands and embeds
- Handle all interaction types (commands, buttons, selects)
- Implement proper permission checks
- Use collectors for multi-step interactions
- Clean up resources (voice connections, collectors)

## Development Workflow

### 1. Feature Development

1. Create GitHub issue describing the feature
2. Create feature branch from master
3. Write tests first (TDD approach)
4. Implement feature to pass tests
5. Test bot functionality in Discord
6. Create PR with detailed description
7. Self-review and merge when ready

### 2. Voice Channel Features

When implementing voice features:

- **Connection Management**: Always check connection state
- **Audio Resources**: Properly create and destroy audio players
- **Error Handling**: Handle disconnections gracefully
- **Quality**: Ensure consistent audio quality
- **Permissions**: Check voice channel permissions

## Testing Strategy

### Unit Tests

- Test individual functions and services
- Mock Discord.js client and interactions
- Test data persistence operations
- Mock external API calls
- Aim for >80% coverage

### Integration Tests

- Test command execution flow
- Test service interactions
- Verify data persistence
- Test error handling paths

### Manual Testing

- Test in actual Discord server
- Verify voice channel functionality
- Test with multiple users
- Check edge cases (permissions, errors)

## Important Context

### Environment Variables

Required in `.env`:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
```

Optional:
```
MAPLE_API_KEY=api_key_if_needed
DEBUG=true
```

### Voice Connection Best Practices

```typescript
// Always check connection state
const connection = getVoiceConnection(guildId);
if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    // Handle disconnection
}

// Clean up on disconnect
connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
        await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
    } catch {
        connection.destroy();
    }
});
```

### Error Handling Pattern

```typescript
try {
    await interaction.deferReply();
    // Perform operation
    await interaction.editReply({ content: 'Success!' });
} catch (error) {
    console.error('Command error:', error);
    const reply = { content: 'An error occurred!', ephemeral: true };
    if (interaction.deferred) {
        await interaction.editReply(reply);
    } else {
        await interaction.reply(reply);
    }
}
```

## MapleStory BGM Integration

### API Integration

- The bot uses a MapleStory BGM API service
- Cache API responses to reduce calls
- Handle API failures gracefully
- Implement retry logic for failed requests

### Audio Streaming

- Stream audio directly from URLs
- Don't download files locally
- Handle stream errors and interruptions
- Implement proper buffering

### Data Persistence

- User favorites stored in `userdata.json`
- Implement file locking for concurrent access
- Regular backups of user data
- Validate data on read/write

## Performance Considerations

- Minimize API calls with caching
- Efficient voice connection management
- Proper resource cleanup
- Monitor memory usage
- Implement connection pooling

## Debugging Guidelines

### Common Issues

1. **Voice Connection Issues**
   - Check bot permissions in voice channel
   - Verify ffmpeg installation
   - Check opus library installation

2. **Command Not Working**
   - Verify command deployment
   - Check bot permissions
   - Review interaction handling

3. **Audio Quality Issues**
   - Verify audio stream URL
   - Check network connectivity
   - Review encoding settings

### Debug Commands

```bash
# Check TypeScript errors
npx tsc --noEmit

# Run specific test file
npm test -- mapleApi.test.ts

# Check for dependency issues
npm ls

# View bot logs
npm run dev
```

## Security Considerations

- **Never commit tokens or secrets**
- Validate all user inputs
- Implement rate limiting
- Sanitize file paths
- Use environment variables for sensitive data
- Regular dependency updates

## Pre-deployment Checklist

- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] Commands deployed to Discord
- [ ] Environment variables set
- [ ] Error handling implemented
- [ ] Voice permissions verified
- [ ] API endpoints tested
- [ ] User data backup system ready

---

_Remember: This file is automatically loaded by Claude. Keep it updated with project-specific information and patterns. When you discover new patterns or useful commands, add them here for future reference._