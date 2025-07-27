// Map Repository - handles map file storage in GitHub
import { RepositoryAPI } from '../api/repository-api.js';

export class MapRepository {
    constructor(token, owner, repo) {
        this.api = new RepositoryAPI(token, owner, repo);
        this.mapsPath = 'maps';
    }

    // Save a complete map set (SVG, coords, config)
    async saveMapSet(mapName, location, svgContent, coordsContent, configContent) {
        const folderPath = `${this.mapsPath}/${location}`;
        const results = {
            svg: null,
            coords: null,
            config: null,
            errors: []
        };
        
        // Prepare files to save
        const files = [];
        
        if (svgContent) {
            files.push({
                path: `${folderPath}/${mapName}.svg`,
                content: svgContent,
                type: 'svg'
            });
        }
        
        if (coordsContent) {
            files.push({
                path: `${folderPath}/${mapName}_coords.json`,
                content: coordsContent,
                type: 'coords'
            });
        }
        
        if (configContent) {
            files.push({
                path: `${folderPath}/${mapName}_config.json`,
                content: configContent,
                type: 'config'
            });
        }

        // Save each file
        for (const file of files) {
            try {
                // Check if file exists to get SHA for update
                const existingFile = await this.api.getFile(file.path);
                const sha = existingFile ? existingFile.sha : null;
                
                const result = await this.api.saveFile(
                    file.path,
                    file.content,
                    `Save ${mapName} ${file.type}`,
                    'main',
                    sha
                );
                
                results[file.type] = result;
            } catch (error) {
                results.errors.push({
                    type: file.type,
                    error: error.message
                });
            }
        }

        // Update gallery index
        try {
            await this.updateGalleryIndex(mapName, location);
        } catch (error) {
            console.warn('Failed to update gallery index:', error);
        }

        return results;
    }

    // Load a complete map set
    async loadMapSet(mapName, location) {
        const folderPath = `${this.mapsPath}/${location}`;
        const results = {
            svg: null,
            coords: null,
            config: null
        };

        // Try to load each file type
        const fileTypes = [
            { type: 'svg', suffix: '.svg' },
            { type: 'coords', suffix: '_coords.json' },
            { type: 'config', suffix: '_config.json' }
        ];

        for (const { type, suffix } of fileTypes) {
            try {
                const file = await this.api.getFile(`${folderPath}/${mapName}${suffix}`);
                if (file) {
                    results[type] = file;
                }
            } catch (error) {
                console.warn(`Failed to load ${type} file:`, error.message);
            }
        }

        return results;
    }

    // List all maps
    async listMaps() {
        const maps = [];
        
        try {
            // Get all location folders
            const locations = await this.api.listFiles(this.mapsPath);
            
            for (const location of locations) {
                if (location.type !== 'dir') continue;
                
                try {
                    // Get maps in this location
                    const files = await this.api.listFiles(location.path);
                    const mapGroups = this.groupFilesByMap(files);
                    
                    // Add location info to each map
                    mapGroups.forEach(map => {
                        map.location = location.name;
                        maps.push(map);
                    });
                } catch (error) {
                    console.warn(`Failed to list maps in ${location.name}:`, error);
                }
            }
        } catch (error) {
            console.warn('Failed to list map locations:', error);
        }

        return maps;
    }

    // List maps in a specific location
    async listLocationMaps(location) {
        const folderPath = `${this.mapsPath}/${location}`;
        
        try {
            const files = await this.api.listFiles(folderPath);
            return this.groupFilesByMap(files);
        } catch (error) {
            if (error.message.includes('404')) {
                return []; // Location doesn't exist yet
            }
            throw error;
        }
    }

    // Group files by map name
    groupFilesByMap(files) {
        const mapGroups = new Map();
        
        files.forEach(file => {
            if (file.type !== 'file') return;
            
            const fileName = file.name;
            let mapName = fileName;
            let fileType = 'unknown';
            
            if (fileName.endsWith('.svg')) {
                mapName = fileName.slice(0, -4);
                fileType = 'svg';
            } else if (fileName.endsWith('_coords.json')) {
                mapName = fileName.slice(0, -12);
                fileType = 'coords';
            } else if (fileName.endsWith('_config.json')) {
                mapName = fileName.slice(0, -12);
                fileType = 'config';
            }
            
            if (!mapGroups.has(mapName)) {
                mapGroups.set(mapName, {
                    name: mapName,
                    files: {}
                });
            }
            
            mapGroups.get(mapName).files[fileType] = {
                name: fileName,
                path: file.path,
                sha: file.sha,
                size: file.size
            };
        });

        // Convert to array and filter out incomplete sets
        return Array.from(mapGroups.values()).filter(map => 
            map.files.svg || map.files.config // Must have at least SVG or config
        );
    }

    // Update gallery index (for future gallery features)
    async updateGalleryIndex(mapName, location) {
        const indexPath = `${this.mapsPath}/gallery_index.json`;
        let index = { maps: [], updated: new Date().toISOString() };
        
        try {
            // Try to load existing index
            const existingFile = await this.api.getFile(indexPath);
            if (existingFile) {
                index = JSON.parse(existingFile.content);
            }
        } catch (error) {
            // Index doesn't exist yet
        }
        
        // Update or add map entry
        const existingEntry = index.maps.findIndex(m => 
            m.name === mapName && m.location === location
        );
        
        const mapEntry = {
            name: mapName,
            location: location,
            updated: new Date().toISOString()
        };
        
        if (existingEntry >= 0) {
            index.maps[existingEntry] = mapEntry;
        } else {
            index.maps.push(mapEntry);
        }
        
        // Save updated index
        const existingFile = await this.api.getFile(indexPath);
        await this.api.saveFile(
            indexPath,
            JSON.stringify(index, null, 2),
            'Update gallery index',
            'main',
            existingFile?.sha
        );
    }

    // Delete a map set
    async deleteMapSet(mapName, location) {
        const folderPath = `${this.mapsPath}/${location}`;
        const results = {
            deleted: [],
            errors: []
        };
        
        const filesToDelete = [
            `${folderPath}/${mapName}.svg`,
            `${folderPath}/${mapName}_coords.json`,
            `${folderPath}/${mapName}_config.json`
        ];
        
        for (const filePath of filesToDelete) {
            try {
                const file = await this.api.getFile(filePath);
                if (file) {
                    await this.api.deleteFile(
                        filePath,
                        `Delete ${mapName} from ${location}`,
                        file.sha
                    );
                    results.deleted.push(filePath);
                }
            } catch (error) {
                if (!error.message.includes('404')) {
                    results.errors.push({
                        path: filePath,
                        error: error.message
                    });
                }
            }
        }
        
        return results;
    }
}