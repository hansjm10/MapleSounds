import axios from 'axios';
import { MapleApiService, MapInfo } from '../../services/mapleApi';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MapleApiService', () => {
  let mapleApiService: MapleApiService;

  beforeEach(() => {
    mapleApiService = new MapleApiService();
    jest.clearAllMocks();
  });

  describe('searchMaps', () => {
    it('should return mapped results when search is successful', async () => {
      const mockMapData: Partial<MapInfo>[] = [
        { name: 'Henesys', streetName: 'Market', id: 100000000 },
        { name: 'Henesys Hunting Ground', streetName: 'Hunting Ground', id: 100010000 }
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockMapData });

      const result = await mapleApiService.searchMaps('Henesys');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://maplestory.io/api/gms/253/map',
        { params: { searchFor: 'Henesys' } }
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...mockMapData[0],
        region: 'gms',
        version: '253'
      });
    });

    it('should return empty array when API call fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await mapleApiService.searchMaps('Invalid');

      expect(result).toEqual([]);
    });
  });

  describe('getMapBgmStream', () => {
    it('should return stream data when successful', async () => {
      const mockStream = { pipe: jest.fn() };
      mockedAxios.get.mockResolvedValueOnce({ data: mockStream });

      const result = await mapleApiService.getMapBgmStream(100000000);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://maplestory.io/api/gms/253/map/100000000/bgm',
        { responseType: 'stream' }
      );
      expect(result).toBe(mockStream);
    });

    it('should throw error when API call fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Stream Error'));

      await expect(mapleApiService.getMapBgmStream(100000000))
        .rejects
        .toThrow('Failed to get BGM stream');
    });
  });

  describe('getMapDetails', () => {
    it('should return map details when successful', async () => {
      const mockMapDetails = { id: 100000000, name: 'Henesys' };
      mockedAxios.get.mockResolvedValueOnce({ data: mockMapDetails });

      const result = await mapleApiService.getMapDetails(100000000);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://maplestory.io/api/gms/253/map/100000000'
      );
      expect(result).toEqual(mockMapDetails);
    });

    it('should return null when API call fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await mapleApiService.getMapDetails(100000000);

      expect(result).toBeNull();
    });
  });

  describe('getMapImageUrl', () => {
    it('should return correct minimap URL', () => {
      const url = mapleApiService.getMapImageUrl(100000000);
      expect(url).toBe('https://maplestory.io/api/gms/253/map/100000000/minimap');
    });
  });
});