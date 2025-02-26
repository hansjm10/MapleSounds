// src/services/mapleApi.ts
import axios from 'axios';

export interface MapInfo {
    name: string;
    streetName: string;
    id: number;
    region: string;
    version: string;
}

export class MapleApiService {
    private readonly baseUrl: string;
    private readonly region: string;
    private readonly version: string;

    constructor(region = 'gms', version = '253') {
        this.baseUrl = 'https://maplestory.io/api';
        this.region = region;
        this.version = version;
    }

    // Search for maps based on search term
    async searchMaps(searchTerm: string): Promise<MapInfo[]> {
        try {
            const response = await axios.get<MapInfo[]>(
                `${this.baseUrl}/${this.region}/${this.version}/map`,
                {
                    params: {
                        searchFor: searchTerm,
                    },
                }
            );
            return response.data.map(map => ({
                ...map,
                region: this.region,
                version: this.version,
            }));
        } catch (error) {
            console.error('Error searching for maps:', error);
            return [];
        }
    }

    // Get the BGM stream for a specific map
    async getMapBgmStream(mapId: number): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}/bgm`,
                {
                    responseType: 'stream',
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error getting BGM stream:', error);
            throw new Error('Failed to get BGM stream');
        }
    }
    async getMapDetails(mapId: number): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}`
            );
            return response.data;
        } catch (error) {
            console.error('Error getting map details:', error);
            return null;
        }
    }
    getMapImageUrl(mapId: number): string {
        return `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}/minimap`;
    }
}