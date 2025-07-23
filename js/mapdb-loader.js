class MapDBLoader {
    constructor() {
        this.GITHUB_API_URL = 'https://api.github.com/repos/elanthia-online/mapdb/releases/latest';
        // Use GitHub's raw content URL which supports CORS
        this.RAW_CONTENT_URL = 'https://raw.githubusercontent.com/elanthia-online/mapdb/main/mapdb.json';
        this.DB_NAME = 'ElanthiaMapDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'mapdb';
        this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    }

    // Initialize IndexedDB
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('version', 'version', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async getLatestRelease() {
        try {
            console.log('Fetching latest release from GitHub API...');
            const response = await fetch(this.GITHUB_API_URL);
            
            console.log('GitHub API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
            const release = await response.json();
            console.log('Latest release:', release.tag_name);
            
            return release;
        } catch (error) {
            console.error('Failed to fetch latest release:', error);
            // Don't throw here - we can still try to download from main branch
            console.log('Will use main branch version instead');
            return { tag_name: 'main-branch' };
        }
    }

    async downloadMapDB(onProgress = null) {
        try {
            console.log('Starting download from raw GitHub content...');
            console.log('URL:', this.RAW_CONTENT_URL);
            
            const response = await fetch(this.RAW_CONTENT_URL);
            console.log('Download response status:', response.status);
            console.log('Download response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            console.log('Content length:', contentLength, 'bytes');
            
            if (!response.body) {
                // Fallback for browsers that don't support streaming
                console.log('Streaming not supported, downloading as text...');
                const text = await response.text();
                if (onProgress) onProgress(100, text.length, text.length);
                return JSON.parse(text);
            }

            let loaded = 0;
            const reader = response.body.getReader();
            const chunks = [];

            console.log('Starting streaming download...');

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                if (onProgress && total) {
                    const percent = Math.round((loaded / total) * 100);
                    onProgress(percent, loaded, total);
                }
                
                // Log progress every 5MB
                if (loaded % (5 * 1024 * 1024) < value.length) {
                    console.log(`Downloaded ${this.formatFileSize(loaded)} / ${this.formatFileSize(total)}`);
                }
            }

            console.log('Download complete, parsing JSON...');
            
            // Convert chunks to text
            const blob = new Blob(chunks);
            const text = await blob.text();
            
            console.log('Text length:', text.length, 'characters');
            
            const parsed = JSON.parse(text);
            console.log('JSON parsed successfully, rooms:', parsed.length);
            
            return parsed;

        } catch (error) {
            console.error('Download failed with error:', error);
            throw new Error(`Unable to download MapDB file: ${error.message}`);
        }
    }

    async getCachedMapDB() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.get('current');
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        console.log('No cached MapDB found');
                        resolve(null);
                        return;
                    }

                    // Check if cache is still valid (within 7 days)
                    const now = Date.now();
                    const cacheAge = now - result.timestamp;
                    
                    if (cacheAge > this.CACHE_DURATION) {
                        console.log('Cached MapDB expired, will download fresh copy');
                        resolve(null);
                        return;
                    }

                    console.log(`Found cached MapDB v${result.version}, age: ${Math.round(cacheAge / (1000 * 60 * 60))} hours`);
                    resolve({
                        data: result.data,
                        version: result.version,
                        timestamp: result.timestamp
                    });
                };
            });
        } catch (error) {
            console.error('Failed to get cached MapDB:', error);
            return null;
        }
    }

    async setCachedMapDB(mapdb, version) {
        try {
            console.log('Caching MapDB to IndexedDB...');
            const db = await this.openDB();
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            const record = {
                id: 'current',
                version: version,
                data: mapdb,
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const request = store.put(record);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log(`MapDB v${version} cached successfully in IndexedDB`);
                    resolve();
                };
            });
        } catch (error) {
            console.error('Failed to cache MapDB:', error);
            // Don't throw - caching failure shouldn't break the app
        }
    }

    async clearCache() {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.clear();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('MapDB cache cleared');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatCacheAge(timestamp) {
        const ageMs = Date.now() - timestamp;
        const hours = Math.floor(ageMs / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} old`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} old`;
        } else {
            return 'just cached';
        }
    }

    async loadMapDB(onProgress = null, forceRefresh = false) {
        try {
            console.log('=== Starting MapDB Load Process ===');

            // Get version info (but don't fail if this doesn't work)
            let latestVersion = 'unknown';
            try {
                const latestRelease = await this.getLatestRelease();
                latestVersion = latestRelease.tag_name;
                console.log(`Latest version: ${latestVersion}`);
            } catch (error) {
                console.log('Could not get version info, proceeding with download anyway');
            }

            // Check cache (unless forcing refresh)
            if (!forceRefresh) {
                const cached = await this.getCachedMapDB();
                
                if (cached) {
                    // Use cache if it exists and is recent enough
                    const cacheAge = this.formatCacheAge(cached.timestamp);
                    console.log(`Using cached MapDB v${cached.version} (${cacheAge})`);
                    
                    if (onProgress) {
                        onProgress(100, 0, 0, `Using cached MapDB v${cached.version} (${cacheAge})`);
                    }
                    
                    return {
                        data: cached.data,
                        version: cached.version,
                        fromCache: true,
                        cacheAge: cacheAge
                    };
                }
            }

            console.log('No valid cache found, downloading from main branch...');

            if (onProgress) {
                onProgress(0, 0, 0, 'Downloading latest MapDB...');
            }

            // Download with progress
            const mapdb = await this.downloadMapDB(
                (percent, loaded, total) => {
                    if (onProgress) {
                        const loadedStr = this.formatFileSize(loaded);
                        const totalStr = total ? this.formatFileSize(total) : 'Unknown';
                        onProgress(percent, loaded, total, 
                            `Downloading MapDB - ${loadedStr}${total ? ` / ${totalStr}` : ''}`);
                    }
                }
            );

            // Cache the result
            await this.setCachedMapDB(mapdb, latestVersion);

            if (onProgress) {
                onProgress(100, 0, 0, `MapDB loaded and cached! (${mapdb.length} rooms)`);
            }

            console.log('=== MapDB Load Complete ===');

            return {
                data: mapdb,
                version: latestVersion,
                fromCache: false
            };

        } catch (error) {
            console.error('=== MapDB Load Failed ===');
            console.error('Error details:', error);
            
            // If download failed, try to use any cached version as fallback
            try {
                const cached = await this.getCachedMapDB();
                if (cached) {
                    console.log('Download failed, using cached version as fallback');
                    if (onProgress) {
                        onProgress(100, 0, 0, `Using cached MapDB v${cached.version} (download failed)`);
                    }
                    return {
                        data: cached.data,
                        version: cached.version,
                        fromCache: true,
                        fallback: true
                    };
                }
            } catch (cacheError) {
                console.error('Cache fallback also failed:', cacheError);
            }
            
            throw error;
        }
    }

    // Extract locations from MapDB for dropdown
    extractLocations(mapdb) {
        const locations = new Set();
        mapdb.forEach(room => {
            if (room.location) {
                locations.add(room.location);
            }
        });
        return Array.from(locations).sort();
    }

    // Extract room tags for theming
    extractTags(mapdb) {
        const tags = new Set();
        mapdb.forEach(room => {
            if (room.tags) {
                room.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }

    // Get rooms by location
    getRoomsByLocation(mapdb, location) {
        return mapdb.filter(room => room.location === location);
    }

    // Parse room ranges like "35593-35601, 35608-35619"
    parseRoomRanges(rangeString) {
        const roomIds = new Set();
        const ranges = rangeString.split(',').map(s => s.trim());
        
        ranges.forEach(range => {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(s => parseInt(s.trim()));
                if (start && end) {
                    for (let i = start; i <= end; i++) {
                        roomIds.add(i);
                    }
                }
            } else {
                const id = parseInt(range);
                if (id) {
                    roomIds.add(id);
                }
            }
        });
        
        return Array.from(roomIds);
    }

    // Get cache info for debugging
    async getCacheInfo() {
        const cached = await this.getCachedMapDB();
        if (!cached) {
            return 'No cached data';
        }
        
        const ageStr = this.formatCacheAge(cached.timestamp);
        const sizeStr = this.formatFileSize(JSON.stringify(cached.data).length);
        
        return `v${cached.version}, ${ageStr}, ${sizeStr}`;
    }
}