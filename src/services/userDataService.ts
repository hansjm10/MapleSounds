import fs from 'fs';
import path from 'path';

export interface SongInfo {
    mapId: number;
    mapName: string;
    streetName: string;
    region: string;
    version: string;
}

export interface Playlist {
    name: string;
    songs: SongInfo[];
    createdAt: string; // Store as ISO string instead of Date object
    updatedAt: string; // Store as ISO string instead of Date object
}

export interface UserData {
    userId: string;
    favorites: SongInfo[];
    playlists: Playlist[];
}

export class UserDataService {
    private dataPath: string;
    private data: Map<string, UserData> = new Map();
    private initialized: boolean = false;
    private saveQueued: boolean = false;

    constructor(dataDirectory: string = './src/data') {
        // Try multiple possible paths to handle both development and production
        const possiblePaths = [
            path.join(process.cwd(), dataDirectory, 'userdata.json'),
            path.join(process.cwd(), 'src', 'data', 'userdata.json'),
            path.join(process.cwd(), 'data', 'userdata.json')
        ];

        // Find the first path that exists, or use the default
        this.dataPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
        console.log('Using data path:', this.dataPath);
        this.loadData();
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.dataPath)) {
                const fileData = fs.readFileSync(this.dataPath, 'utf-8');
                if (fileData.trim() === '') {
                    // Handle empty file case
                    console.log('User data file is empty, initializing new data');
                    this.initialized = true;
                    return;
                }

                const jsonData = JSON.parse(fileData);
                for (const [userId, userData] of Object.entries(jsonData)) {
                    // Ensure proper structure
                    const validatedData = this.validateUserData(userData as UserData);
                    this.data.set(userId, validatedData);
                }
                console.log(`Loaded user data for ${this.data.size} users`);
            } else {
                // Create data directory if it doesn't exist
                const directory = path.dirname(this.dataPath);
                if (!fs.existsSync(directory)) {
                    fs.mkdirSync(directory, { recursive: true });
                }
                // Create empty file with a valid JSON object
                fs.writeFileSync(this.dataPath, JSON.stringify({}, null, 2));
                console.log('Created new user data file');
            }
            this.initialized = true;
        } catch (error) {
            console.error('Error loading user data:', error);
            // Initialize with empty data on error
            this.data = new Map();
            this.initialized = true;
        }
    }
    private validateUserData(userData: any): UserData {
        // Ensure all required structures exist
        return {
            userId: userData.userId || '',
            favorites: Array.isArray(userData.favorites) ? userData.favorites : [],
            playlists: Array.isArray(userData.playlists) ? userData.playlists.map((p: any) => ({
                name: p.name || 'Unnamed Playlist',
                songs: Array.isArray(p.songs) ? p.songs : [],
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString()
            })) : []
        };
    }

    private saveData(): boolean {
        if (!this.initialized) {
            console.log('Data not initialized yet, queueing save for later');
            this.saveQueued = true;
            return false;
        }

        try {
            const jsonData: Record<string, UserData> = {};
            for (const [userId, userData] of this.data.entries()) {
                jsonData[userId] = userData;
            }

            const directory = path.dirname(this.dataPath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Use atomic write to ensure file isn't corrupted if process crashes
            const tempPath = `${this.dataPath}.tmp`;

            // Use a custom replacer function to handle BigInt values
            fs.writeFileSync(tempPath, JSON.stringify(jsonData, (key, value) => {
                // Convert BigInt to Number
                if (typeof value === 'bigint') {
                    return Number(value);
                }
                return value;
            }, 2));

            // Rename is atomic on most filesystems
            fs.renameSync(tempPath, this.dataPath);
            console.log(`Saved user data for ${this.data.size} users`);
            return true;
        } catch (error) {
            console.error('Error saving user data:', error);
            return false;
        }
    }

    private getUserData(userId: string): UserData {
        if (!this.data.has(userId)) {
            this.data.set(userId, {
                userId,
                favorites: [],
                playlists: []
            });
            this.saveData();
        }
        return this.data.get(userId)!;
    }

    /**
     * Adds a song to a user's favorites
     * @param userId - The Discord ID of the user
     * @param song - The song information to add to favorites
     * @returns true if the song was added successfully, false otherwise
     */
    addToFavorites(userId: string, song: SongInfo): boolean {
        try {
            console.log(`[DEBUG] Adding favorite for user ${userId}. Current data path: ${this.dataPath}`);
            console.log(`[DEBUG] Song to add:`, song);
            
            const userData = this.getUserData(userId);
            console.log(`[DEBUG] Current user data before adding:`, userData);

            // Ensure mapId is a number
            const normalizedSong = {
                ...song,
                mapId: Number(song.mapId)
            };

            // Check if already favorited
            if (userData.favorites.some(fav => fav.mapId === normalizedSong.mapId)) {
                console.log(`[DEBUG] Song already in favorites`);
                return false;
            }

            // Add the favorite
            userData.favorites.push(normalizedSong);
            
            // Update the Map
            this.data.set(userId, userData);
            console.log(`[DEBUG] Updated user data in memory:`, this.data.get(userId));

            // Save data and return success/failure
            const saveResult = this.saveData();
            console.log(`[DEBUG] Save result:`, saveResult);
            
            if (!saveResult) {
                console.error(`Failed to save favorites for user ${userId}`);
            } else {
                // Verify the save by reading the file
                const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
                console.log(`[DEBUG] File content after save:`, fileContent);
            }
            return saveResult;
        } catch (error) {
            console.error(`Error adding favorite for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Removes a song from a user's favorites
     * @param userId - The Discord ID of the user
     * @param mapId - The ID of the map/song to remove
     * @returns true if the song was removed successfully, false otherwise
     */
    removeFromFavorites(userId: string, mapId: number): boolean {
        try {
            const userData = this.getUserData(userId);
            const initialLength = userData.favorites.length;

            userData.favorites = userData.favorites.filter(song => song.mapId !== mapId);

            if (userData.favorites.length !== initialLength) {
                return this.saveData();
            }
            return false;
        } catch (error) {
            console.error(`Error removing favorite for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Retrieves a user's favorite songs
     * @param userId - The Discord ID of the user
     * @returns An array of the user's favorite songs
     */
    getFavorites(userId: string): SongInfo[] {
        try {
            console.log(`[DEBUG] Getting favorites for user ${userId}. Current data path: ${this.dataPath}`);
            
            // Force reload data from disk to ensure we have latest
            this.loadData();
            
            const userData = this.getUserData(userId);
            console.log(`[DEBUG] User data from memory:`, userData);
            
            // Also check file directly
            const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
            console.log(`[DEBUG] Current file content:`, fileContent);
            
            return userData.favorites;
        } catch (error) {
            console.error(`Error getting favorites for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Creates a new playlist for a user
     * @param userId - The Discord ID of the user
     * @param playlistName - The name for the new playlist
     * @returns true if the playlist was created successfully, false otherwise
     */
    createPlaylist(userId: string, playlistName: string): boolean {
        try {
            const userData = this.getUserData(userId);

            // Check if playlist name already exists
            if (userData.playlists.some(p => p.name.toLowerCase() === playlistName.toLowerCase())) {
                return false;
            }

            // Create new playlist with ISO string dates
            userData.playlists.push({
                name: playlistName,
                songs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return this.saveData();
        } catch (error) {
            console.error(`Error creating playlist for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Adds a song to a user's playlist
     * @param userId - The Discord ID of the user
     * @param playlistName - The name of the playlist to add to
     * @param song - The song information to add
     * @returns true if the song was added successfully, false otherwise
     */
    addToPlaylist(userId: string, playlistName: string, song: SongInfo): boolean {
        const userData = this.getUserData(userId);
        const playlist = userData.playlists.find(
            p => p.name.toLowerCase() === playlistName.toLowerCase()
        );

        if (!playlist) {
            return false;
        }

        // Check if song already in playlist
        if (playlist.songs.some(s => s.mapId === song.mapId)) {
            return false;
        }

        playlist.songs.push(song);
        playlist.updatedAt = new Date().toISOString();
        this.saveData();
        return true;
    }

    /**
     * Removes a song from a user's playlist
     * @param userId - The Discord ID of the user
     * @param playlistName - The name of the playlist
     * @param index - The index of the song to remove
     * @returns true if the song was removed successfully, false otherwise
     */
    removeFromPlaylist(userId: string, playlistName: string, index: number): boolean {
        const userData = this.getUserData(userId);
        const playlist = userData.playlists.find(
            p => p.name.toLowerCase() === playlistName.toLowerCase()
        );

        if (!playlist || index < 0 || index >= playlist.songs.length) {
            return false;
        }

        playlist.songs.splice(index, 1);
        playlist.updatedAt = new Date().toISOString();
        this.saveData();
        return true;
    }

    /**
     * Gets a specific playlist for a user
     * @param userId - The Discord ID of the user
     * @param playlistName - The name of the playlist to retrieve
     * @returns The playlist object or null if not found
     */
    getPlaylist(userId: string, playlistName: string): Playlist | null {
        const userData = this.getUserData(userId);
        return userData.playlists.find(
            p => p.name.toLowerCase() === playlistName.toLowerCase()
        ) || null;
    }

    /**
     * Gets all playlists for a user
     * @param userId - The Discord ID of the user
     * @returns An array of the user's playlists
     */
    getPlaylists(userId: string): Playlist[] {
        return this.getUserData(userId).playlists;
    }

    /**
     * Deletes a playlist for a user
     * @param userId - The Discord ID of the user
     * @param playlistName - The name of the playlist to delete
     * @returns true if the playlist was deleted successfully, false otherwise
     */
    deletePlaylist(userId: string, playlistName: string): boolean {
        const userData = this.getUserData(userId);
        const initialLength = userData.playlists.length;

        userData.playlists = userData.playlists.filter(
            p => p.name.toLowerCase() !== playlistName.toLowerCase()
        );

        if (userData.playlists.length !== initialLength) {
            this.saveData();
            return true;
        }
        return false;
    }
}