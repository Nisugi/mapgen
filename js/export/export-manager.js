// Export Manager - handles all export functionality
import { eventBus, EVENTS } from '../utils/event-bus.js';
import { StatusManager } from '../utils/status-manager.js';

export class ExportManager {
    constructor(config, roomSelector, uiManager, mapGenerator, mapdbVersion) {
        this.config = config;
        this.roomSelector = roomSelector;
        this.uiManager = uiManager;
        this.mapGenerator = mapGenerator;
        this.mapdbVersion = mapdbVersion;
        
        // Listen for export events
        eventBus.on(EVENTS.EXPORT_SVG, this.exportSVG.bind(this));
        eventBus.on(EVENTS.EXPORT_COORDS, this.exportCoordinates.bind(this));
        eventBus.on(EVENTS.EXPORT_CONFIG, this.exportConfig.bind(this));
    }

    exportCoordinates() {
        const uiState = this.uiManager.getUIState();
        
        if (!uiState.groupData.groups || uiState.groupData.groups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        try {
            const rooms = this.roomSelector.getSelectedRooms();
            
            // Get the same config as generate/preview
            const groupsWithNames = uiState.groupData.groups.map((group, index) => ({
                ...group,
                name: uiState.groupData.names.get(index) || `Group ${index + 1}`
            }));
            
            const config = {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                groupOffsets: uiState.groupData.offsets,
                groups: groupsWithNames
            };
            
            // Generate positions
            const result = this.mapGenerator.generateMapWithGroups(rooms, config);
            const positions = this.mapGenerator.calculateRoomPositionsWithGroups(
                rooms, 
                new Map(rooms.map(r => [r.id, r]))
            ).positions;
            
            // Calculate actual positions with offsets
            const finalPositions = this.mapGenerator.applyGroupOffsets(result.groups);
            
            // Get bounds for offset calculation
            const coords = Array.from(finalPositions.values());
            const minX = Math.min(...coords.map(p => p.x));
            const minY = Math.min(...coords.map(p => p.y));
            const padding = 2;
            const offsetX = -minX + padding;
            const offsetY = -minY + padding;
            
            // Generate coordinate data
            let coordData = [];
            rooms.forEach(room => {
                const pos = finalPositions.get(room.id);
                if (pos) {
                    const x = (pos.x + offsetX) * config.edgeLength;
                    const y = (pos.y + offsetY) * config.edgeLength;
                    const bounds = this.mapGenerator.getRoomBounds(x, y, config.roomShape, config.roomSize);
                    
                    coordData.push({
                        id: room.id,
                        image: document.getElementById('output-name').value + '.png',
                        image_coords: [
                            Math.round(bounds.left),
                            Math.round(bounds.top),
                            Math.round(bounds.right),
                            Math.round(bounds.bottom)
                        ]
                    });
                }
            });
            
            // Create export window
            this.showCoordinatesExport(coordData);
            
        } catch (error) {
            alert('Error exporting coordinates: ' + error.message);
        }
    }

    exportCoordinateFile() {
        const uiState = this.uiManager.getUIState();
        
        if (!uiState.groupData.groups || uiState.groupData.groups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const coordData = {
            mapName: document.getElementById('output-name').value,
            mapId: mapId,
            version: this.mapdbVersion,
            created: new Date().toISOString(),
            groups: uiState.groupData.groups.map((group, index) => ({
                index: index,
                name: uiState.groupData.names.get(index) || `Group ${index + 1}`,
                offset: uiState.groupData.offsets.get(index) || { x: 0, y: 0 },
                labelOffset: uiState.groupData.labelOffsets.get(index) || { x: 0, y: 0 },
                rooms: group.rooms.map(room => ({
                    id: room.id,
                    position: group.positions.get(room.id)
                }))
            })),
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels,
            config: {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth,
                colors: this.config.colors,
                tagColors: Array.from(this.config.tagColors.entries()),
                fonts: this.config.fonts
            }
        };

        const blob = new Blob([JSON.stringify(coordData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${mapId}_coordinates.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        StatusManager.update('Coordinate file exported!');
    }

    importCoordinateFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const coordData = JSON.parse(event.target.result);
                    
                    // Validate structure
                    if (!coordData.groups || !Array.isArray(coordData.groups)) {
                        throw new Error('Invalid coordinate file format');
                    }
                    
                    // Apply coordinate data
                    const groupData = this.uiManager.panels.groupPositioning.getGroupData();
                    groupData.offsets.clear();
                    groupData.names.clear();
                    groupData.labelOffsets.clear();
                    
                    coordData.groups.forEach(group => {
                        groupData.offsets.set(group.index, group.offset || { x: 0, y: 0 });
                        groupData.names.set(group.index, group.name || `Group ${group.index + 1}`);
                        groupData.labelOffsets.set(group.index, group.labelOffset || { x: 0, y: 0 });
                    });
                    
                    if (coordData.crossGroupConnections) {
                        this.uiManager.panels.crossConnections.setConnections(coordData.crossGroupConnections);
                    }
                    
                    if (coordData.customLabels) {
                        this.uiManager.panels.customLabels.setLabels(coordData.customLabels);
                    }
                    
                    // Apply config if available
                    if (coordData.config) {
                        this.applyImportedConfig(coordData.config);
                    }
                    
                    StatusManager.update(`Coordinates imported from ${file.name}!`);
                    
                } catch (error) {
                    alert('Error importing coordinate file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    applyImportedConfig(config) {
        if (config.edgeLength) {
            this.config.edgeLength = config.edgeLength;
            document.getElementById('edge-length').value = config.edgeLength;
            document.getElementById('edge-length-value').textContent = config.edgeLength + 'px';
        }
        if (config.roomShape) {
            this.config.roomShape = config.roomShape;
            document.getElementById('room-shape').value = config.roomShape;
        }
        if (config.roomSize) {
            this.config.roomSize = config.roomSize;
            document.getElementById('room-size').value = config.roomSize;
            document.getElementById('room-size-value').textContent = config.roomSize + 'px';
        }
        if (config.colors) {
            this.config.colors = { ...this.config.colors, ...config.colors };
            document.getElementById('default-color').value = config.colors.default || this.config.colors.default;
            document.getElementById('background-color').value = config.colors.background || this.config.colors.background;
            document.getElementById('connection-color').value = config.colors.connections || this.config.colors.connections;
            document.getElementById('vertical-connection-color').value = config.colors.verticalConnections || this.config.colors.verticalConnections;
        }
        if (config.tagColors) {
            this.config.tagColors = new Map(config.tagColors);
            this.uiManager.panels.themeColors.renderTagColorsList();
        }
    }

    showCoordinatesExport(coordData) {
        const exportWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        
        // Format the data for mapdb
        let mapdbFormat = coordData.map(room => {
            return `  "${room.id}": {\n` +
                   `    "image": "${room.image}",\n` +
                   `    "image_coords": [${room.image_coords.join(', ')}]\n` +
                   `  }`;
        }).join(',\n');
        
        exportWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Room Coordinates Export</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    h2 { color: #333; }
                    .export-container {
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        padding: 20px;
                        margin-bottom: 20px;
                    }
                    textarea {
                        width: 100%;
                        height: 400px;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        border: 1px solid #ccc;
                        padding: 10px;
                    }
                    button {
                        background: #5a67d8;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                    button:hover {
                        background: #4c51bf;
                    }
                    .info {
                        background: #e6f3ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <h2>Room Coordinates Export</h2>
                <div class="info">
                    <strong>Image name:</strong> ${document.getElementById('output-name').value}.png<br>
                    <strong>Total rooms:</strong> ${coordData.length}<br>
                    <strong>Format:</strong> MapDB image_coords format (left, top, right, bottom)
                </div>
                <div class="export-container">
                    <h3>MapDB Format (for room definitions):</h3>
                    <textarea id="mapdb-format" readonly>{
${mapdbFormat}
}</textarea>
                    <button onclick="document.getElementById('mapdb-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy MapDB Format</button>
                </div>
                <div class="export-container">
                    <h3>JSON Format (for reference):</h3>
                    <textarea id="json-format" readonly>${JSON.stringify(coordData, null, 2)}</textarea>
                    <button onclick="document.getElementById('json-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy JSON Format</button>
                </div>
            </body>
            </html>
        `);
    }

    generateConfigForExport(mapName, description = '') {
        const uiState = this.uiManager.getUIState();
        const roomSelection = uiState.roomSelection;
        
        let roomSelectionConfig = {
            method: roomSelection.method
        };
        
        if (roomSelection.method === 'location') {
            roomSelectionConfig.locations = roomSelection.locations;
        } else {
            roomSelectionConfig.ranges = roomSelection.customRanges.ranges;
            roomSelectionConfig.useUID = roomSelection.customRanges.useUID;
        }
        
        // Add exclusions if present
        if (roomSelection.exclusions.ranges) {
            roomSelectionConfig.exclusions = roomSelection.exclusions.ranges;
            roomSelectionConfig.excludeUseUID = roomSelection.exclusions.useUID;
        }

        const config = {
            metadata: {
                name: mapName,
                description: description,
                author: window.app?.github?.user?.login || 'unknown',
                created: new Date().toISOString(),
                mapdbVersion: this.mapdbVersion,
                appVersion: '1.0.0'
            },
            roomSelection: roomSelectionConfig,
            appearance: {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth
            },
            colors: {
                default: this.config.colors.default,
                background: this.config.colors.background,
                connections: this.config.colors.connections,
                verticalConnections: this.config.colors.verticalConnections,
                tagColors: Array.from(this.config.tagColors.entries())
            },
            displayOptions: uiState.displayOptions,
            fonts: {
                labels: { ...this.config.fonts.labels },
                rooms: { ...this.config.fonts.rooms }
            },
            backgroundSettings: {
                useBackground: this.config.useBackground,
                backgroundImage: this.config.backgroundImage
            },
            groupPositioning: {
                offsets: Array.from(uiState.groupData.offsets.entries()),
                names: Array.from(uiState.groupData.names.entries()),
                labelOffsets: Array.from(uiState.groupData.labelOffsets.entries())
            },
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels
        };

        return JSON.stringify(config, null, 2);
    }
}