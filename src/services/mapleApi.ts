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

    /**
     * Searches for MapleStory maps that match the provided search term
     * @param searchTerm - The text to search for in map names
     * @returns A promise that resolves to an array of matching map information
     */
    async searchMaps(searchTerm: string): Promise<MapInfo[]> {
        try {
            const response = await axios.get<MapInfo[]>(
                `${this.baseUrl}/${this.region}/${this.version}/map`,
                {
                    params: {
                        searchFor: searchTerm,
                    },
                },
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

    /**
     * Retrieves detailed information about a specific map by its ID
     * @param mapId - The numeric ID of the map to retrieve
     * @returns A promise that resolves to the map information or null if not found
     */
    async getMapInfo(mapId: number): Promise<MapInfo | null> {
        try {
            // First try to get detailed info
            const detailsResponse = await this.getMapDetails(mapId);
            if (detailsResponse) {
                return {
                    name: detailsResponse.name || `Map ${mapId}`,
                    streetName: detailsResponse.streetName || 'Unknown Location',
                    id: mapId,
                    region: this.region,
                    version: this.version,
                };
            }

            // Fallback to basic info
            return {
                name: `Map ${mapId}`,
                streetName: 'Unknown Location',
                id: mapId,
                region: this.region,
                version: this.version,
            };
        } catch (error) {
            console.error(`Error getting map info for ID ${mapId}:`, error);
            return null;
        }
    }

    /**
     * Gets the audio stream for a map's background music
     * @param mapId - The numeric ID of the map whose BGM to retrieve
     * @returns A promise that resolves to a readable stream of the BGM audio
     * @throws Will throw an error if the BGM stream cannot be retrieved
     */
    async getMapBgmStream(mapId: number): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}/bgm`,
                {
                    responseType: 'stream',
                },
            );
            return response.data;
        } catch (error) {
            console.error('Error getting BGM stream:', error);
            throw new Error('Failed to get BGM stream');
        }
    }

    /**
     * Retrieves detailed map information from the API
     * @param mapId - The numeric ID of the map to retrieve details for
     * @returns A promise that resolves to the detailed map information or null if not found
     */
    async getMapDetails(mapId: number): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}`,
            );
            return response.data;
        } catch (error) {
            console.error('Error getting map details:', error);
            return null;
        }
    }

    /**
     * Constructs the URL for a map's minimap image
     * @param mapId - The numeric ID of the map
     * @param thumbnail - Whether to return a thumbnail-sized image
     * @returns The URL string for the map image
     */
    getMapImageUrl(mapId: number, thumbnail: boolean = false): string {
        if (thumbnail) {
            // Return a smaller image for thumbnails
            return `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}/minimap?width=120&height=120`;
        }
        return `${this.baseUrl}/${this.region}/${this.version}/map/${mapId}/minimap`;
    }
}
