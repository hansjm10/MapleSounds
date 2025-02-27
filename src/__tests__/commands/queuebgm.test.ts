import { QueuebgmCommand } from '../../commands/queuebgm';
import { VoiceManager } from '../../utils/voiceManager';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SongInfo } from '../../services/userDataService';

// Mock the VoiceManager
jest.mock('../../utils/voiceManager');

// Create mock for ChatInputCommandInteraction
const createMockInteraction = (subcommand: string, options: any = {}) => {
    const mockInteraction = {
        deferReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockImplementation(() => {
            // Mock followUp to return an object with createMessageComponentCollector
            return {
                createMessageComponentCollector: jest.fn().mockReturnValue({
                    on: jest.fn()
                })
            };
        }),
        guildId: 'mock-guild-123',
        options: {
            getSubcommand: jest.fn().mockReturnValue(subcommand),
            getInteger: jest.fn((name) => options[name] || null),
            getString: jest.fn((name) => options[name] || null)
        },
        user: {
            id: 'mock-user-123'
        }
    };
    
    return mockInteraction as unknown as ChatInputCommandInteraction;
};

describe('QueuebgmCommand', () => {
    let queuebgmCommand: QueuebgmCommand;
    let mockSong: SongInfo;
    
    beforeEach(() => {
        queuebgmCommand = new QueuebgmCommand();
        mockSong = {
            mapId: 100000000,
            mapName: 'Henesys',
            streetName: 'Market',
            region: 'gms',
            version: '253'
        };
        
        // Reset all mocks
        jest.clearAllMocks();
        
        // Setup basic VoiceManager mock implementations
        (VoiceManager.getQueue as jest.Mock).mockReturnValue([]);
        (VoiceManager.getCurrentlyPlaying as jest.Mock).mockReturnValue(null);
        (VoiceManager.getLoopMode as jest.Mock).mockReturnValue('none');
        (VoiceManager.getVolume as jest.Mock).mockReturnValue(50);
    });
    
    describe('Command Structure', () => {
        it('should have the correct name and description', () => {
            expect(queuebgmCommand.data.name).toBe('queuebgm');
            expect(queuebgmCommand.data.description).toBe('Manage the BGM playback queue');
        });
        
        it('should have the necessary subcommands', () => {
            const subcommands = queuebgmCommand.data.options.filter(option => option.toJSON().type === 1);
            const subcommandNames = subcommands.map(option => option.toJSON().name);
            
            expect(subcommandNames).toContain('show');
            expect(subcommandNames).toContain('shuffle');
            expect(subcommandNames).toContain('clear');
            expect(subcommandNames).toContain('remove');
            expect(subcommandNames).toContain('loop');
            expect(subcommandNames).toContain('skip');
            expect(subcommandNames).toContain('move');
        });
    });
    
    describe('Show Queue', () => {
        it('should report when queue is empty and nothing is playing', async () => {
            const interaction = createMockInteraction('show');
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('There is nothing currently playing and the queue is empty')
            );
        });
        
        it('should display the current playing song and queue', async () => {
            const interaction = createMockInteraction('show');
            
            // Mock currently playing song
            (VoiceManager.getCurrentlyPlaying as jest.Mock).mockReturnValue(mockSong);
            
            // Mock queue with one song
            (VoiceManager.getQueue as jest.Mock).mockReturnValue([
                { song: { ...mockSong, mapName: 'Ellinia' }, requestedBy: 'user-123' }
            ]);
            
            await queuebgmCommand.execute(interaction);
            
            // Just check that followUp was called
            expect(interaction.followUp).toHaveBeenCalled();
        });
    });
    
    describe('Shuffle Queue', () => {
        it('should report success when queue is shuffled', async () => {
            const interaction = createMockInteraction('shuffle');
            
            // Mock shuffle success
            (VoiceManager.shuffleQueue as jest.Mock).mockReturnValue(true);
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.shuffleQueue).toHaveBeenCalledWith('mock-guild-123');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Queue has been shuffled')
            );
        });
        
        it('should report failure when queue cannot be shuffled', async () => {
            const interaction = createMockInteraction('shuffle');
            
            // Mock shuffle failure
            (VoiceManager.shuffleQueue as jest.Mock).mockReturnValue(false);
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Cannot shuffle')
            );
        });
    });
    
    describe('Clear Queue', () => {
        it('should report success when queue is cleared', async () => {
            const interaction = createMockInteraction('clear');
            
            // Mock clear success
            (VoiceManager.clearQueue as jest.Mock).mockReturnValue(true);
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.clearQueue).toHaveBeenCalledWith('mock-guild-123');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Queue has been cleared')
            );
        });
        
        it('should report when queue is already empty', async () => {
            const interaction = createMockInteraction('clear');
            
            // Mock clear failure
            (VoiceManager.clearQueue as jest.Mock).mockReturnValue(false);
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Queue is already empty')
            );
        });
    });
    
    describe('Remove From Queue', () => {
        it('should remove a song at the specified position', async () => {
            const interaction = createMockInteraction('remove', { position: 1 });
            
            // Mock successful removal
            (VoiceManager.removeFromQueue as jest.Mock).mockReturnValue({
                song: mockSong,
                requestedBy: 'user-123'
            });
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.removeFromQueue).toHaveBeenCalledWith('mock-guild-123', 0);
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining(`Removed **${mockSong.mapName}** from position 1`)
            );
        });
        
        it('should report failure for invalid position', async () => {
            const interaction = createMockInteraction('remove', { position: 10 });
            
            // Mock removal failure
            (VoiceManager.removeFromQueue as jest.Mock).mockReturnValue(null);
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Invalid position 10')
            );
        });
    });
    
    describe('Loop Mode', () => {
        it('should set loop mode to song', async () => {
            const interaction = createMockInteraction('loop', { mode: 'song' });
            
            // Mock loop mode setting
            (VoiceManager.setLoopMode as jest.Mock).mockReturnValue('song');
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.setLoopMode).toHaveBeenCalledWith('mock-guild-123', 'song');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Loop mode set to repeat current song')
            );
        });
        
        it('should set loop mode to queue', async () => {
            const interaction = createMockInteraction('loop', { mode: 'queue' });
            
            // Mock loop mode setting
            (VoiceManager.setLoopMode as jest.Mock).mockReturnValue('queue');
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.setLoopMode).toHaveBeenCalledWith('mock-guild-123', 'queue');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Loop mode set to repeat the entire queue')
            );
        });
        
        it('should disable loop mode', async () => {
            const interaction = createMockInteraction('loop', { mode: 'none' });
            
            // Mock loop mode setting
            (VoiceManager.setLoopMode as jest.Mock).mockReturnValue('none');
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.setLoopMode).toHaveBeenCalledWith('mock-guild-123', 'none');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Loop mode disabled')
            );
        });
    });
    
    describe('Skip', () => {
        it('should skip to the next song', async () => {
            const interaction = createMockInteraction('skip');
            
            // Mock skip success
            (VoiceManager.skipToNext as jest.Mock).mockReturnValue(true);
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.skipToNext).toHaveBeenCalledWith('mock-guild-123');
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Skipped to the next song')
            );
        });
        
        it('should report when nothing to skip to', async () => {
            const interaction = createMockInteraction('skip');
            
            // Mock skip failure
            (VoiceManager.skipToNext as jest.Mock).mockReturnValue(false);
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Nothing to skip to')
            );
        });
    });
    
    describe('Move', () => {
        it('should move a song from one position to another', async () => {
            const interaction = createMockInteraction('move', { from: 1, to: 3 });
            
            // Mock move success
            (VoiceManager.moveInQueue as jest.Mock).mockReturnValue(true);
            
            await queuebgmCommand.execute(interaction);
            
            expect(VoiceManager.moveInQueue).toHaveBeenCalledWith('mock-guild-123', 0, 2);
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Moved song from position 1 to position 3')
            );
        });
        
        it('should report failure for invalid positions', async () => {
            const interaction = createMockInteraction('move', { from: 10, to: 20 });
            
            // Mock move failure
            (VoiceManager.moveInQueue as jest.Mock).mockReturnValue(false);
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.stringContaining('Failed to move song')
            );
        });
    });
    
    describe('Unknown Subcommand', () => {
        it('should handle unknown subcommands gracefully', async () => {
            const interaction = createMockInteraction('nonexistent');
            
            await queuebgmCommand.execute(interaction);
            
            expect(interaction.followUp).toHaveBeenCalledWith('Unknown subcommand.');
        });
    });
});