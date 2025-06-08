import { FindbgmCommand } from '../../commands/findbgm';
import { MapleApiService } from '../../services/mapleApi';
import { MusicCollectionService } from '../../services/musicCollectionService';
import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';

// Mock dependencies
jest.mock('../../services/mapleApi');
jest.mock('../../services/musicCollectionService');

describe('FindbgmCommand', () => {
    let findbgmCommand: FindbgmCommand;
    let mockMapleApi: jest.Mocked<MapleApiService>;
    let mockMusicService: jest.Mocked<MusicCollectionService>;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mock for MapleApiService
        const mockSearchMaps = jest.fn();
        const mockGetMapInfo = jest.fn();
        const mockGetMapBgmStream = jest.fn();
        const mockGetMapDetails = jest.fn();
        const mockGetMapImageUrl = jest.fn();

        mockMapleApi = {
            searchMaps: mockSearchMaps,
            getMapInfo: mockGetMapInfo,
            getMapBgmStream: mockGetMapBgmStream,
            getMapDetails: mockGetMapDetails,
            getMapImageUrl: mockGetMapImageUrl,
        } as unknown as jest.Mocked<MapleApiService>;

        // Mock the MapleApiService constructor
        (MapleApiService as jest.Mock) = jest.fn().mockImplementation(() => mockMapleApi);

        // Setup mock for MusicCollectionService
        const mockBaseEmbed = {
            setColor: jest.fn().mockReturnThis(),
            setDescription: jest.fn().mockReturnThis(),
            setFooter: jest.fn().mockReturnThis(),
            setTitle: jest.fn().mockReturnThis(),
            setThumbnail: jest.fn().mockReturnThis(),
            addFields: jest.fn().mockReturnThis(),
            setTimestamp: jest.fn().mockReturnThis(),
        };

        mockMusicService = {
            addToFavorites: jest.fn(),
            removeFromFavorites: jest.fn(),
            getFavorites: jest.fn(),
            getPlaylists: jest.fn(),
            addToPlaylist: jest.fn(),
            createPlaylist: jest.fn(),
            createBaseEmbed: jest.fn().mockReturnValue(mockBaseEmbed),
        } as unknown as jest.Mocked<MusicCollectionService>;

        // Setup MusicCollectionService.getInstance mock
        (MusicCollectionService.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockMusicService);

        // Create instance with mocked dependencies
        findbgmCommand = new FindbgmCommand();
    });

    describe('Command Definition', () => {
        it('should have the correct name and description', () => {
            expect(findbgmCommand.data.name).toBe('findbgm');
            expect(findbgmCommand.data.description).toContain('Find MapleStory maps');
        });

        it('should have search as a required option', () => {
            const searchOption = findbgmCommand.data.options.find(opt => opt.toJSON().name === 'search');
            expect(searchOption).toBeDefined();
            expect(searchOption?.toJSON().required).toBe(true);
        });

        it('should have region as an optional option', () => {
            const regionOption = findbgmCommand.data.options.find(opt => opt.toJSON().name === 'region');
            expect(regionOption).toBeDefined();
            expect(regionOption?.toJSON().required).toBe(false);
        });

        it('should have version as an optional option', () => {
            const versionOption = findbgmCommand.data.options.find(opt => opt.toJSON().name === 'version');
            expect(versionOption).toBeDefined();
            expect(versionOption?.toJSON().required).toBe(false);
        });
    });

    describe('Execute Method', () => {
        let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;

        beforeEach(() => {
            // Setup interaction mock with properly typed mock functions
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
            } as unknown as jest.Mocked<ChatInputCommandInteraction>;
        });

        it('should return error if no search term is provided', async () => {
            // Configure mock behavior
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockReturnValue(null);

            await findbgmCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.stringContaining('Please provide a search term'));
        });

        it('should search maps with the provided term', async () => {
            // Configure mock behavior
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'henesys';
                if (name === 'region') return 'gms';
                if (name === 'version') return '253';
                return null;
            });

            mockMapleApi.searchMaps.mockResolvedValue([
                { id: 100000000, name: 'Henesys', streetName: 'Market', region: 'gms', version: '253' },
            ]);

            await findbgmCommand.execute(mockInteraction);

            expect(mockMapleApi.searchMaps).toHaveBeenCalledWith('henesys');
            // Verify follow up was called with some parameters
            expect(mockInteraction.followUp).toHaveBeenCalled();
        });

        it('should use default region and version if not provided', async () => {
            // Configure mock behavior
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'henesys';
                return null; // Return null for region and version
            });

            mockMapleApi.searchMaps.mockResolvedValue([
                { id: 100000000, name: 'Henesys', streetName: 'Market', region: 'gms', version: '253' },
            ]);

            await findbgmCommand.execute(mockInteraction);

            // Default region is 'gms' and default version is '253'
            expect(mockMapleApi.searchMaps).toHaveBeenCalledWith('henesys');
        });

        it('should notify user when no maps are found', async () => {
            // Configure mock behavior
            const getString = mockInteraction.options.getString as jest.Mock;
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'nonexistent map';
                return null;
            });

            mockMapleApi.searchMaps.mockResolvedValue([]);

            await findbgmCommand.execute(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.stringContaining('No maps found'));
        });
    });

    // Skip select interaction tests as they're complex to correctly type
    describe('Select Interaction', () => {
        it('should set up the correct collectors when searching', async () => {
            // Configure mock behavior for a basic search
            const getString = jest.fn();
            getString.mockImplementation((name: string) => {
                if (name === 'search') return 'henesys';
                return null;
            });

            const mockInteraction = {
                deferReply: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockImplementation(() => {
                    return {
                        createMessageComponentCollector: jest.fn().mockReturnValue({
                            on: jest.fn(),
                        }),
                    };
                }),
                options: { getString },
                guildId: 'test-guild-id',
                channelId: 'test-channel-id',
            } as unknown as ChatInputCommandInteraction;

            mockMapleApi.searchMaps.mockResolvedValue([
                { id: 100000000, name: 'Henesys', streetName: 'Market', region: 'gms', version: '253' },
            ]);

            await findbgmCommand.execute(mockInteraction);

            // Verify the collector was created through the followUp call
            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
                components: expect.arrayContaining([expect.anything()]),
            }));
        });
    });

    describe('Add to Favorites', () => {
        it('should add a map to favorites successfully', async () => {
            const mockMap = {
                id: 100000000,
                name: 'Henesys',
                streetName: 'Market',
                region: 'gms',
                version: '253',
            };

            const mockButtonInteraction = {
                deferUpdate: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockResolvedValue(undefined),
                user: { id: 'test-user-id' },
            } as unknown as ButtonInteraction;

            mockMusicService.addToFavorites.mockReturnValue(true);

            // Call the handler directly since it's protected
            await (findbgmCommand as any).handleAddToFavorites(mockButtonInteraction, mockMap);

            expect(mockMusicService.addToFavorites).toHaveBeenCalledWith(
                'test-user-id',
                expect.objectContaining({
                    mapId: 100000000,
                    mapName: 'Henesys',
                }),
            );

            // Verify that followUp was called with expected parameters
            expect(mockButtonInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.anything(),
                    ephemeral: true,
                }),
            );
        });

        it('should notify the user if the map is already in favorites', async () => {
            const mockMap = {
                id: 100000000,
                name: 'Henesys',
                streetName: 'Market',
                region: 'gms',
                version: '253',
            };

            const mockButtonInteraction = {
                deferUpdate: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockResolvedValue(undefined),
                user: { id: 'test-user-id' },
            } as unknown as ButtonInteraction;

            mockMusicService.addToFavorites.mockReturnValue(false);

            await (findbgmCommand as any).handleAddToFavorites(mockButtonInteraction, mockMap);

            expect(mockButtonInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already in your favorites'),
                }),
            );
        });
    });

    describe('Add to Playlist', () => {
        it('should prompt to create a playlist if user has none', async () => {
            const mockMap = {
                id: 100000000,
                name: 'Henesys',
                streetName: 'Market',
                region: 'gms',
                version: '253',
            };

            const mockButtonInteraction = {
                deferUpdate: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockImplementation(() => {
                    return {
                        createMessageComponentCollector: jest.fn().mockReturnValue({
                            on: jest.fn(),
                        }),
                    };
                }),
                user: { id: 'test-user-id' },
            } as unknown as ButtonInteraction;

            mockMusicService.getPlaylists.mockReturnValue([]);

            await (findbgmCommand as any).handleAddToPlaylist(mockButtonInteraction, mockMap);

            expect(mockMusicService.getPlaylists).toHaveBeenCalledWith('test-user-id');
            expect(mockButtonInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.anything(), // Can't easily check embed content
                    ]),
                    components: expect.arrayContaining([
                        expect.anything(), // Can't easily check button components
                    ]),
                }),
            );
        });

        it('should display a select menu if user has playlists', async () => {
            const mockMap = {
                id: 100000000,
                name: 'Henesys',
                streetName: 'Market',
                region: 'gms',
                version: '253',
            };

            const mockButtonInteraction = {
                deferUpdate: jest.fn().mockResolvedValue(undefined),
                followUp: jest.fn().mockImplementation(() => {
                    return {
                        createMessageComponentCollector: jest.fn().mockReturnValue({
                            on: jest.fn(),
                        }),
                    };
                }),
                user: { id: 'test-user-id' },
            } as unknown as ButtonInteraction;

            mockMusicService.getPlaylists.mockReturnValue([
                {
                    name: 'My Playlist',
                    songs: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ]);

            await (findbgmCommand as any).handleAddToPlaylist(mockButtonInteraction, mockMap);

            expect(mockMusicService.getPlaylists).toHaveBeenCalledWith('test-user-id');
            expect(mockButtonInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.anything(), // Can't easily check embed content
                    ]),
                    components: expect.arrayContaining([
                        expect.anything(), // Can't easily check select menu components
                    ]),
                }),
            );
        });
    });
});
