import { VoiceManager } from '../../utils/voiceManager';
import { MapleApiService } from '../../services/mapleApi';
import { SongInfo } from '../../services/userDataService';

// Mock dependencies
jest.mock('@discordjs/voice', () => ({
    joinVoiceChannel: jest.fn(),
    createAudioPlayer: jest.fn(() => ({
        on: jest.fn(),
        play: jest.fn()
    })),
    createAudioResource: jest.fn(),
    AudioPlayerStatus: {
        Playing: 'playing',
        Idle: 'idle'
    },
    VoiceConnectionStatus: {
        Ready: 'ready',
        Connecting: 'connecting',
        Signalling: 'signalling',
        Disconnected: 'disconnected'
    },
    entersState: jest.fn(),
    getVoiceConnection: jest.fn()
}));

jest.mock('../../services/mapleApi');

describe('VoiceManager', () => {
    let mockSongs: SongInfo[];
    let mockGuildId: string;
    let mockInteraction: any;

    beforeEach(() => {
        mockSongs = [
            {
                mapId: 1,
                mapName: 'Test Map 1',
                streetName: 'Test Street 1',
                region: 'gms',
                version: '253'
            },
            {
                mapId: 2,
                mapName: 'Test Map 2',
                streetName: 'Test Street 2',
                region: 'gms',
                version: '253'
            }
        ];

        mockGuildId = '123456789';

        mockInteraction = {
            guild: {
                id: mockGuildId,
                name: 'Test Guild',
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        voice: {
                            channel: {
                                id: '123',
                                name: 'Test Channel',
                                permissionsFor: jest.fn().mockReturnValue({
                                    has: jest.fn().mockReturnValue(true)
                                })
                            }
                        }
                    }),
                    me: {
                        voice: {}
                    }
                },
                voiceAdapterCreator: {}
            },
            user: {
                id: '123',
                tag: 'testuser#1234'
            },
            guildId: mockGuildId,
            followUp: jest.fn(),
            isRepliable: jest.fn().mockReturnValue(true)
        };
    });

    afterEach(() => {
        // Clear all queues and state after each test
        VoiceManager.clearQueueForGuild(mockGuildId);
        jest.clearAllMocks();
    });

    describe('Queue Management', () => {
        it('should set and get queue for a guild', () => {
            VoiceManager.setQueueForGuild(mockGuildId, mockSongs);
            const queue = VoiceManager.getQueueForGuild(mockGuildId);
            expect(queue).toEqual(mockSongs);
        });

        it('should return empty array for non-existent queue', () => {
            const queue = VoiceManager.getQueueForGuild('nonexistent');
            expect(queue).toEqual([]);
        });

        it('should clear queue for a guild', () => {
            VoiceManager.setQueueForGuild(mockGuildId, mockSongs);
            VoiceManager.clearQueueForGuild(mockGuildId);
            const queue = VoiceManager.getQueueForGuild(mockGuildId);
            expect(queue).toEqual([]);
        });

        it('should clear queue when stopping playback', () => {
            VoiceManager.setQueueForGuild(mockGuildId, mockSongs);
            VoiceManager.stopPlayback(mockGuildId);
            const queue = VoiceManager.getQueueForGuild(mockGuildId);
            expect(queue).toEqual([]);
        });
    });

    describe('Playback Management', () => {
        it('should track currently playing song', async () => {
            const mockStream = {} as any;
            await VoiceManager.playAudioInChannel(
                mockInteraction,
                mockStream,
                'Test Map 1 (Test Street 1)',
                1,
                mockInteraction
            );

            const currentlyPlaying = VoiceManager.getCurrentlyPlaying(mockGuildId);
            expect(currentlyPlaying).toBeTruthy();
            expect(currentlyPlaying?.mapId).toBe(1);
        });

        it('should clear currently playing on stop', () => {
            VoiceManager.setQueueForGuild(mockGuildId, mockSongs);
            VoiceManager.stopPlayback(mockGuildId);
            const currentlyPlaying = VoiceManager.getCurrentlyPlaying(mockGuildId);
            expect(currentlyPlaying).toBeNull();
        });
    });

    describe('Volume Control', () => {
        it('should set and get volume', () => {
            const volume = 50;
            VoiceManager.setVolume(mockGuildId, volume);
            expect(VoiceManager.getVolume(mockGuildId)).toBe(volume);
        });

        it('should clamp volume between 0 and 100', () => {
            VoiceManager.setVolume(mockGuildId, 150);
            expect(VoiceManager.getVolume(mockGuildId)).toBe(100);

            VoiceManager.setVolume(mockGuildId, -50);
            expect(VoiceManager.getVolume(mockGuildId)).toBe(0);
        });

        it('should return default volume when not set', () => {
            const volume = VoiceManager.getVolume('nonexistent');
            expect(volume).toBe(20); // Default volume is 20%
        });
    });
});