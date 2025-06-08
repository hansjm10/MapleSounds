import fs from 'fs';
import path from 'path';
import type { ISongInfo } from '../../services/userDataService';
import { UserDataService } from '../../services/userDataService';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('UserDataService', () => {
  let userDataService: UserDataService;
  const testDataDir = './test-data';
  const _testDataPath = path.join(process.cwd(), testDataDir, 'userdata.json');

  const mockSong: ISongInfo = {
    mapId: 100000000,
    mapName: 'Henesys',
    streetName: 'Market',
    region: 'gms',
    version: '253',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fs.existsSync for data directory
    mockedFs.existsSync.mockImplementation(() => true);
    // Mock empty JSON file
    mockedFs.readFileSync.mockReturnValue('{}');
    userDataService = new UserDataService(testDataDir);
  });

  describe('Favorites Management', () => {
    const userId = 'testUser123';

    it('should add a song to favorites', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      const result = userDataService.addToFavorites(userId, mockSong);

      expect(result).toBe(true);
      expect(userDataService.getFavorites(userId)).toContainEqual(mockSong);
    });

    it('should not add duplicate songs to favorites', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.addToFavorites(userId, mockSong);
      const result = userDataService.addToFavorites(userId, mockSong);

      expect(result).toBe(false);
      expect(userDataService.getFavorites(userId)).toHaveLength(1);
    });

    it('should remove a song from favorites', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.addToFavorites(userId, mockSong);
      const result = userDataService.removeFromFavorites(userId, mockSong.mapId);

      expect(result).toBe(true);
      expect(userDataService.getFavorites(userId)).toHaveLength(0);
    });
  });

  describe('Playlist Management', () => {
    const userId = 'testUser123';
    const playlistName = 'My Test Playlist';

    it('should create a new playlist', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      const result = userDataService.createPlaylist(userId, playlistName);

      expect(result).toBe(true);
      const playlists = userDataService.getPlaylists(userId);
      expect(playlists).toHaveLength(1);
      expect(playlists[0].name).toBe(playlistName);
    });

    it('should not create duplicate playlists', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.createPlaylist(userId, playlistName);
      const result = userDataService.createPlaylist(userId, playlistName);

      expect(result).toBe(false);
      expect(userDataService.getPlaylists(userId)).toHaveLength(1);
    });

    it('should add a song to a playlist', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.createPlaylist(userId, playlistName);
      const result = userDataService.addToPlaylist(userId, playlistName, mockSong);

      expect(result).toBe(true);
      const playlist = userDataService.getPlaylist(userId, playlistName);
      expect(playlist?.songs).toContainEqual(mockSong);
    });

    it('should remove a song from a playlist', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.createPlaylist(userId, playlistName);
      userDataService.addToPlaylist(userId, playlistName, mockSong);
      const result = userDataService.removeFromPlaylist(userId, playlistName, 0);

      expect(result).toBe(true);
      const playlist = userDataService.getPlaylist(userId, playlistName);
      expect(playlist?.songs).toHaveLength(0);
    });

    it('should delete a playlist', () => {
      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.renameSync.mockImplementation(() => {});

      userDataService.createPlaylist(userId, playlistName);
      const result = userDataService.deletePlaylist(userId, playlistName);

      expect(result).toBe(true);
      expect(userDataService.getPlaylists(userId)).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    const userId = 'testUser123';

    it('should handle file system errors gracefully', () => {
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = userDataService.addToFavorites(userId, mockSong);
      expect(result).toBe(false);
    });

    it('should handle corrupted data file', () => {
      mockedFs.readFileSync.mockReturnValue('invalid json');

      const newService = new UserDataService(testDataDir);
      const favorites = newService.getFavorites(userId);

      expect(favorites).toEqual([]);
    });
  });
});
