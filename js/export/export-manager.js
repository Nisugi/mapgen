// Export Manager - coordinates all export functionality
import { SVGExporter } from './svg-exporter.js';
import { CoordinateExporter } from './coordinate-exporter.js';
import { ConfigExporter } from './config-exporter.js';
import { eventBus, EVENTS } from '../utils/event-bus.js';
import { StatusManager } from '../utils/status-manager.js';

export class ExportManager {
    constructor(config, roomSelector, uiManager, mapGenerator, mapdbVersion) {
        this.config = config;
        this.roomSelector = roomSelector;
        this.uiManager = uiManager;
        this.mapGenerator = mapGenerator;
        this.mapdbVersion = mapdbVersion;
        
        // Initialize exporters
        this.svgExporter = new SVGExporter();
        this.coordinateExporter = new CoordinateExporter(mapGenerator);
        this.configExporter = new ConfigExporter(mapdbVersion);
        
        // Listen for export events
        eventBus.on(EVENTS.EXPORT_SVG, this.exportSVG.bind(this));
        eventBus.on(EVENTS.EXPORT_COORDS, this.exportCoordinates.bind(this));
        eventBus.on(EVENTS.EXPORT_CONFIG, this.exportConfig.bind(this));
    }

    exportSVG(svgContent, filename) {
        this.svgExporter.download(svgContent, filename);
    }

    exportCoordinates() {
        const uiState = this.uiManager.getUIState();
        
        if (!uiState.groupData.groups || uiState.groupData.groups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        try {
            const rooms = this.roomSelector.getSelectedRooms();
            const outputName = document.getElementById('output-name').value;
            
            const coordData = this.coordinateExporter.generateCoordinates(
                rooms, 
                uiState, 
                this.config,
                outputName
            );
            
            this.coordinateExporter.showExportWindow(coordData, outputName);
            
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
        const mapName = document.getElementById('output-name').value;
        
        const coordData = {
            mapName: mapName,
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

        this.coordinateExporter.downloadJSON(coordData, `${mapId}_coordinates.json`);
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

    exportConfig() {
        const uiState = this.uiManager.getUIState();
        const mapName = document.getElementById('output-name').value;
        
        const config = this.configExporter.generateConfig(
            mapName,
            uiState,
            this.config,
            window.app?.github?.user?.login || 'unknown'
        );
        
        return config;
    }

    generateConfigForExport(mapName, description = '') {
        const uiState = this.uiManager.getUIState();
        
        return this.configExporter.generateConfig(
            mapName,
            uiState,
            this.config,
            window.app?.github?.user?.login || 'unknown',
            description
        );
    }
}