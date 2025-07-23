class MapDBLoader {
    constructor() {
        // Load from your own repository
        this.LOCAL_MAPDB_URL = './mapdb.json';
        this.DB_NAME = 'ElanthiaMapDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'mapdb';
        this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
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

    async downloadMapDB(onProgress = null) {
        try {
            console.log('Loading MapDB from repository...');
            
            const response = await fetch(this.LOCAL_MAPDB_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Simple loading with progress
            const text = await response.text();
            console.log('MapDB text loaded, parsing JSON...');
            
            if (onProgress) {
                onProgress(50, 0, 0, 'Parsing MapDB...');
            }
            
            const mapdb = JSON.parse(text);
            console.log(`MapDB parsed: ${mapdb.length} rooms`);
            
            if (onProgress) {
                onProgress(100, 0, 0, 'MapDB loaded successfully!');
            }
            
            return mapdb;

        } catch (error) {
            console.error('Failed to load MapDB:', error);
            throw new Error(`Unable to load MapDB: ${error.message}`);
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
                        resolve(null);
                        return;
                    }

                    // Check if cache is still valid
                    const now = Date.now();
                    const cacheAge = now - result.timestamp;
                    
                    if (cacheAge > this.CACHE_DURATION) {
                        console.log('Cache expired');
                        resolve(null);
                        return;
                    }

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
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('Failed to cache MapDB:', error);
        }
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
            return 'fresh';
        }
    }

    async loadMapDB(onProgress = null, forceRefresh = false) {
        try {
            console.log('Starting MapDB load...');

            // Check cache first
            if (!forceRefresh) {
                const cached = await this.getCachedMapDB();
                if (cached) {
                    const cacheAge = this.formatCacheAge(cached.timestamp);
                    console.log(`Using cached MapDB (${cacheAge})`);
                    
                    if (onProgress) {
                        onProgress(100, 0, 0, `Using cached MapDB (${cacheAge})`);
                    }
                    
                    return {
                        data: cached.data,
                        version: cached.version,
                        fromCache: true
                    };
                }
            }

            // Load fresh copy
            const mapdb = await this.downloadMapDB(onProgress);

            // Cache it
            await this.setCachedMapDB(mapdb, 'v0.2.1');

            return {
                data: mapdb,
                version: 'v0.2.1',
                fromCache: false
            };

        } catch (error) {
            console.error('MapDB loading failed:', error);
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
}