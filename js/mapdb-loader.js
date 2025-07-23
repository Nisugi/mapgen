class MapDBLoader {
    constructor() {
        // Load from your own repository - no external URLs!
        this.LOCAL_MAPDB_URL = './mapdb.json';
    }

    async loadMapDB(onProgress = null) {
        try {
            console.log('Loading MapDB from local file...');
            
            if (onProgress) {
                onProgress(10, 0, 0, 'Loading MapDB from repository...');
            }
            
            const response = await fetch(this.LOCAL_MAPDB_URL);
            
            if (!response.ok) {
                throw new Error(`Failed to load mapdb.json: ${response.status} ${response.statusText}`);
            }

            if (onProgress) {
                onProgress(50, 0, 0, 'Parsing MapDB data...');
            }
            
            const mapdb = await response.json();
            
            console.log(`MapDB loaded successfully: ${mapdb.length} rooms`);
            
            if (onProgress) {
                onProgress(100, 0, 0, `MapDB loaded! (${mapdb.length} rooms)`);
            }
            
            return {
                data: mapdb,
                version: 'v0.2.1',
                fromCache: false
            };

        } catch (error) {
            console.error('Failed to load MapDB:', error);
            throw new Error(`Unable to load MapDB: ${error.message}`);
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

    // Extract room tags for theming - ADD THIS FUNCTION
    extractTags(mapdb) {
        const tags = new Set();
        mapdb.forEach(room => {
            if (room.tags && Array.isArray(room.tags)) {
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
}