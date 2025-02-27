import { MusicCollectionService } from '../../services/musicCollectionService';
import { UserDataService, SongInfo } from '../../services/userDataService';
import { VoiceManager } from '../../utils/voiceManager';
import { Readable } from 'stream';
import { EmbedBuilder, ButtonInteraction } from 'discord.js';

// Mock dependencies
jest.mock('../../services/userDataService');
jest.mock('../../services/mapleApi');
jest.mock('../../utils/voiceManager');

describe('MusicCollectionService', () => {
    let musicCollectionService: MusicCollectionService;
    let mockUserDataService: jest.Mocked<UserDataService>;
    
    // Mock song data
    const mockSong: SongInfo = {
        mapId: 100000000,
        mapName: 'Henesys',
        streetName: 'Market',
        region: 'gms',
        version: '253'
    };
    
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Setup UserDataService mock
        mockUserDataService = {
            addToFavorites: jest.fn(),
            removeFromFavorites: jest.fn(),
            getFavorites: jest.fn(),
            createPlaylist: jest.fn(),
            addToPlaylist: jest.fn(),
            removeFromPlaylist: jest.fn(),
            getPlaylist: jest.fn(),
            getPlaylists: jest.fn(),
            deletePlaylist: jest.fn()
        } as unknown as jest.Mocked<UserDataService>;
        
        // Create service instance and inject mocked dependencies
        musicCollectionService = MusicCollectionService.getInstance();
        (musicCollectionService as any).userDataService = mockUserDataService;
    });
    
    describe('Favorites Management', () => {
        it('should add a song to favorites', () => {
            mockUserDataService.addToFavorites.mockReturnValue(true);
            
            const result = musicCollectionService.addToFavorites('user123', mockSong);
            
            expect(result).toBe(true);
            expect(mockUserDataService.addToFavorites).toHaveBeenCalledWith('user123', mockSong);
        });
        
        it('should remove a song from favorites', () => {
            mockUserDataService.removeFromFavorites.mockReturnValue(true);
            
            const result = musicCollectionService.removeFromFavorites('user123', 100000000);
            
            expect(result).toBe(true);
            expect(mockUserDataService.removeFromFavorites).toHaveBeenCalledWith('user123', 100000000);
        });
        
        it('should get all favorites for a user', () => {
            const mockFavorites = [mockSong];
            mockUserDataService.getFavorites.mockReturnValue(mockFavorites);
            
            const favorites = musicCollectionService.getFavorites('user123');
            
            expect(favorites).toBe(mockFavorites);
            expect(mockUserDataService.getFavorites).toHaveBeenCalledWith('user123');
        });
        
        it('should get a random favorite if available', () => {
            const mockFavorites = [mockSong];
            mockUserDataService.getFavorites.mockReturnValue(mockFavorites);
            
            const randomFavorite = musicCollectionService.getRandomFavorite('user123');
            
            expect(randomFavorite).toBe(mockSong);
            expect(mockUserDataService.getFavorites).toHaveBeenCalledWith('user123');
        });
        
        it('should return null for random favorite if no favorites exist', () => {
            mockUserDataService.getFavorites.mockReturnValue([]);
            
            const randomFavorite = musicCollectionService.getRandomFavorite('user123');
            
            expect(randomFavorite).toBeNull();
        });
        
        it('should create a favorites embed', () => {
            mockUserDataService.getFavorites.mockReturnValue([mockSong]);
            
            const { embed, row } = musicCollectionService.createFavoritesEmbed('user123');
            
            expect(embed).toBeInstanceOf(EmbedBuilder);
            expect(embed.data.title).toContain('Favorite');
            expect(embed.data.fields).toHaveLength(1);
            expect(embed.data.fields?.[0].name).toContain('Henesys');
            expect(row.components).toHaveLength(1);
            // We can only check the existence of components, not their properties due to TypeScript issues
        });
    });
    
    describe('Playlist Management', () => {
        it('should create a new playlist', () => {
            mockUserDataService.createPlaylist.mockReturnValue(true);
            
            const result = musicCollectionService.createPlaylist('user123', 'My Playlist');
            
            expect(result).toBe(true);
            expect(mockUserDataService.createPlaylist).toHaveBeenCalledWith('user123', 'My Playlist');
        });
        
        it('should add a song to a playlist', () => {
            mockUserDataService.addToPlaylist.mockReturnValue(true);
            
            const result = musicCollectionService.addToPlaylist('user123', 'My Playlist', mockSong);
            
            expect(result).toBe(true);
            expect(mockUserDataService.addToPlaylist).toHaveBeenCalledWith('user123', 'My Playlist', mockSong);
        });
        
        it('should remove a song from a playlist', () => {
            mockUserDataService.removeFromPlaylist.mockReturnValue(true);
            
            const result = musicCollectionService.removeFromPlaylist('user123', 'My Playlist', 2);
            
            expect(result).toBe(true);
            expect(mockUserDataService.removeFromPlaylist).toHaveBeenCalledWith('user123', 'My Playlist', 2);
        });
        
        it('should get a specific playlist', () => {
            const mockPlaylist = {
                name: 'My Playlist',
                songs: [mockSong],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            mockUserDataService.getPlaylist.mockReturnValue(mockPlaylist);
            
            const playlist = musicCollectionService.getPlaylist('user123', 'My Playlist');
            
            expect(playlist).toBe(mockPlaylist);
            expect(mockUserDataService.getPlaylist).toHaveBeenCalledWith('user123', 'My Playlist');
        });
        
        it('should get all playlists for a user', () => {
            const mockPlaylists = [{
                name: 'My Playlist',
                songs: [mockSong],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }];
            
            mockUserDataService.getPlaylists.mockReturnValue(mockPlaylists);
            
            const playlists = musicCollectionService.getPlaylists('user123');
            
            expect(playlists).toBe(mockPlaylists);
            expect(mockUserDataService.getPlaylists).toHaveBeenCalledWith('user123');
        });
        
        it('should delete a playlist', () => {
            mockUserDataService.deletePlaylist.mockReturnValue(true);
            
            const result = musicCollectionService.deletePlaylist('user123', 'My Playlist');
            
            expect(result).toBe(true);
            expect(mockUserDataService.deletePlaylist).toHaveBeenCalledWith('user123', 'My Playlist');
        });
        
        it('should create a playlist embed', () => {
            const mockPlaylist = {
                name: 'My Playlist',
                songs: [mockSong],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const embed = musicCollectionService.createPlaylistEmbed(mockPlaylist);
            
            expect(embed).toBeInstanceOf(EmbedBuilder);
            expect(embed.data.title).toContain('My Playlist');
            expect(embed.data.fields).toHaveLength(1);
            expect(embed.data.fields?.[0].name).toContain('Henesys');
        });
        
        it('should create playlist action buttons', () => {
            const row = musicCollectionService.createPlaylistActionRow('My Playlist');
            
            expect(row.components).toHaveLength(3);
            // We can only check the existence of components, not their properties due to TypeScript issues
        });
    });
    
    describe('Base Embed Creation', () => {
        it('should create a base embed with standard styling', () => {
            const embed = musicCollectionService.createBaseEmbed('Test Title');
            
            expect(embed).toBeInstanceOf(EmbedBuilder);
            expect(embed.data.title).toBe('Test Title');
            expect(embed.data.color).toBeDefined();
            expect(embed.data.thumbnail).toBeDefined();
            expect(embed.data.footer).toBeDefined();
        });
    });
});