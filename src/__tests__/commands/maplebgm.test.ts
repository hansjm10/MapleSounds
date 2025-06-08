import { MaplebgmCommand } from '../../commands/maplebgm';
import { MapleApiService } from '../../services/mapleApi';
import { VoiceManager } from '../../utils/voiceManager';
import type { ChatInputCommandInteraction } from 'discord.js';

// Mock dependencies
jest.mock('../../services/mapleApi');
jest.mock('../../utils/voiceManager');

describe('MaplebgmCommand', () => {
    let maplebgmCommand: MaplebgmCommand;
    let mockMapleApi: jest.Mocked<MapleApiService>;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mock for MapleApiService constructor
        const mockSearchMaps = jest.fn();
        const mockGetMapInfo = jest.fn();
        const mockGetMapBgmStream = jest.fn();
        const mockGetMapDetails = jest.fn();
        const mockGetMapImageUrl = jest.fn();

        // Create a proper MapleApiService mock
        mockMapleApi = {
            searchMaps: mockSearchMaps,
            getMapInfo: mockGetMapInfo,
            getMapBgmStream: mockGetMapBgmStream,
            getMapDetails: mockGetMapDetails,
            getMapImageUrl: mockGetMapImageUrl,
        } as unknown as jest.Mocked<MapleApiService>;

        // Mock the MapleApiService constructor
        (MapleApiService as jest.Mock) = jest.fn().mockImplementation(() => mockMapleApi);

        // Create instance with mocked dependencies
        maplebgmCommand = new MaplebgmCommand();

        // Setup VoiceManager mock implementations
        (VoiceManager.playAudioInChannel as jest.Mock) = jest.fn().mockResolvedValue(true);
        (VoiceManager.getVolume as jest.Mock) = jest.fn().mockReturnValue(50);
    });

    describe('Command Definition', () => {
        it('should have the correct name and description', () => {
            expect(maplebgmCommand.data.name).toBe('maplebgm');
            expect(maplebgmCommand.data.description).toContain('Play or add Maplestory BGM');
        });

        it('should have search as an option', () => {
            const searchOption = maplebgmCommand.data.options.find(opt => opt.toJSON().name === 'search');
            expect(searchOption).toBeDefined();
        });

        it('should have region as an option', () => {
            const regionOption = maplebgmCommand.data.options.find(opt => opt.toJSON().name === 'region');
            expect(regionOption).toBeDefined();
        });

        it('should have version as an option', () => {
            const versionOption = maplebgmCommand.data.options.find(opt => opt.toJSON().name === 'version');
            expect(versionOption).toBeDefined();
        });
    });

    describe('Execute Method', () => {
        let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;

        beforeEach(() => {
            // Setup interaction mock
            // Create a properly typed mock for CommandInteraction
            const getString = jest.fn();

            mockInteraction = {
                deferReply: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockImplementation(() => {
                    return {
                        createMessageComponentCollector: jest.fn().mockReturnValue({
                            on: jest.fn(),
                        }),
                    };
                }),
                options: {
                    getString,
                },
                guildId: 'test-guild-id',
                channelId: 'test-channel-id',
                member: {},
            } as unknown as jest.Mocked<ChatInputCommandInteraction>;
        });

        it('should search maps when a search term is provided', async () => {
            // Setup return values for getString
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'henesys';
                if (name === 'region') return 'gms';
                if (name === 'version') return '253';
                return null;
            });

            // Set up mock implementation
            mockMapleApi.searchMaps.mockResolvedValue([
                { id: 100000000, name: 'Henesys', streetName: 'Market', region: 'gms', version: '253' },
            ]);

            await maplebgmCommand.execute(mockInteraction);

            expect(mockMapleApi.searchMaps).toHaveBeenCalledWith('henesys');
            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
                embeds: expect.anything(),
            }));
        });

        it('should notify user when no maps are found', async () => {
            // Setup return values for getString
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'nonexistent';
                return null;
            });

            mockMapleApi.searchMaps.mockResolvedValue([]);

            await maplebgmCommand.execute(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.stringContaining('No maps found'));
        });
    });
});
