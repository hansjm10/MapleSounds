import { SearchbgmCommand } from '../../commands/searchbgm';
import { MapleApiService } from '../../services/mapleApi';
import { UserDataService } from '../../services/userDataService';
import { VoiceManager } from '../../utils/voiceManager';

// Mock the dependencies
jest.mock('../../services/mapleApi');
jest.mock('../../services/userDataService');
jest.mock('../../utils/voiceManager');

describe('SearchbgmCommand', () => {
    let command: SearchbgmCommand;
    let mockInteraction: any;
    let mockMapleApi: jest.Mocked<MapleApiService>;
    let mockUserDataService: jest.Mocked<UserDataService>;

    beforeEach(() => {
        command = new SearchbgmCommand();
        mockMapleApi = new MapleApiService() as jest.Mocked<MapleApiService>;
        mockUserDataService = new UserDataService() as jest.Mocked<UserDataService>;

        // Mock interaction
        mockInteraction = {
            deferReply: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue({
                createMessageComponentCollector: jest.fn().mockReturnValue({
                    on: jest.fn(),
                    stop: jest.fn()
                }),
                edit: jest.fn()
            }),
            options: {
                getString: jest.fn()
            },
            guildId: '123',
            member: {}
        };
    });

    it('should create a valid slash command', () => {
        expect(command.data.name).toBe('search');
        expect(command.data.description).toBe('Search for MapleStory BGMs');
        expect(command.data.options).toHaveLength(1);
        expect(command.data.options[0].toJSON()).toMatchObject({
            name: 'query',
            description: 'Search term for BGM/map name',
            required: true,
            type: 3 // STRING type
        });
    });

    it('should handle empty search results', async () => {
        mockInteraction.options.getString.mockReturnValue('nonexistent');
        mockMapleApi.searchMaps.mockResolvedValue([]);

        await command.execute(mockInteraction);

        expect(mockInteraction.deferReply).toHaveBeenCalled();
        expect(mockInteraction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        title: '❌ No Results Found'
                    })
                ])
            })
        );
    });

    it('should display search results', async () => {
        const mockResults = [
            {
                name: 'Test Map 1',
                streetName: 'Test Street 1',
                id: 1,
                region: 'gms',
                version: '253'
            },
            {
                name: 'Test Map 2',
                streetName: 'Test Street 2',
                id: 2,
                region: 'gms',
                version: '253'
            }
        ];

        mockInteraction.options.getString.mockReturnValue('test');
        mockMapleApi.searchMaps.mockResolvedValue(mockResults);

        await command.execute(mockInteraction);

        expect(mockInteraction.deferReply).toHaveBeenCalled();
        expect(mockInteraction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        title: '🔍 BGM Search Results',
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                name: expect.stringContaining('Test Map 1'),
                                value: expect.stringContaining('Test Street 1')
                            }),
                            expect.objectContaining({
                                name: expect.stringContaining('Test Map 2'),
                                value: expect.stringContaining('Test Street 2')
                            })
                        ])
                    })
                ]),
                components: expect.arrayContaining([
                    expect.objectContaining({
                        components: expect.arrayContaining([
                            expect.objectContaining({
                                customId: expect.stringContaining('play_search_1'),
                                style: 1 // PRIMARY
                            })
                        ])
                    })
                ])
            })
        );
    });
});