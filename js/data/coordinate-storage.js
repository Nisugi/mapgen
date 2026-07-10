// Coordinate Storage Class for persistence
export class CoordinateStorage {
    constructor() {
        this.storageKey = 'elanthia_map_coordinates';
        // Human curation is expensive - keep it for a year
        this.maxStorageAge = 365 * 24 * 60 * 60 * 1000;
    }

    saveCoordinates(mapId, version, coordData) {
        try {
            const storage = this.getStorage();
            storage[mapId] = {
                version: version,
                data: coordData,
                savedAt: Date.now()
            };
            
            // Clean old entries
            this.cleanOldEntries(storage);
            
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
        } catch (error) {
            console.warn('Failed to save coordinates to localStorage:', error);
        }
    }

    loadCoordinates(mapId, version) {
        try {
            const storage = this.getStorage();
            const entry = storage[mapId];
            
            if (!entry) return null;

            const age = Date.now() - entry.savedAt;
            if (age >= this.maxStorageAge) {
                delete storage[mapId];
                localStorage.setItem(this.storageKey, JSON.stringify(storage));
                return null;
            }

            const data = entry.data;
            // Ensure backward compatibility - add pixelModes if missing
            if (data && !data.groupPixelModes) {
                data.groupPixelModes = [];
            }

            if (entry.version === version) {
                return data;
            }

            // mapdb version changed: index-keyed edits are meaningless (group
            // order reshuffles) but anchor-keyed edits still apply - keep them.
            console.warn(`Saved coordinates for ${mapId} are from a different mapdb version; applying anchor-keyed edits only`);
            return {
                ...data,
                groupOffsets: [],
                groupPixelModes: [],
                groupNames: [],
                groupLabelOffsets: [],
                versionMismatch: true
            };
            
        } catch (error) {
            console.warn('Failed to load coordinates from localStorage:', error);
            return null;
        }
    }

    getStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to parse stored coordinates:', error);
            return {};
        }
    }

    cleanOldEntries(storage) {
        const now = Date.now();
        const toDelete = [];
        
        for (const [mapId, entry] of Object.entries(storage)) {
            const age = now - entry.savedAt;
            if (age > this.maxStorageAge) {
                toDelete.push(mapId);
            }
        }
        
        toDelete.forEach(mapId => delete storage[mapId]);
    }

    listSavedMaps() {
        const storage = this.getStorage();
        return Object.keys(storage).map(mapId => ({
            mapId,
            version: storage[mapId].version,
            savedAt: new Date(storage[mapId].savedAt).toISOString()
        }));
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear coordinate storage:', error);
        }
    }
}