// Map Generation Manager - handles map generation logic
import { eventBus, EVENTS } from './utils/event-bus.js';
import { StatusManager } from './utils/status-manager.js';

export class MapGeneratorManager {
    constructor(config, roomSelector, uiManager, coordinateStorage) {
        this.config = config;
        this.roomSelector = roomSelector;
        this.uiManager = uiManager;
        this.coordinateStorage = coordinateStorage;
        this.mapGenerator = null; // Will be set by main app
        this.currentGroups = [];
        this.mapdbVersion = null;
        
        // Listen for generation events
        eventBus.on(EVENTS.MAP_GENERATE, this.generateMap.bind(this));
        eventBus.on(EVENTS.MAP_PREVIEW, this.previewMap.bind(this));
    }

    setMapGenerator(generator) {
        this.mapGenerator = generator;
    }

    setMapDBVersion(version) {
        this.mapdbVersion = version;
    }

    generateMap() {
        try {
            const rooms = this.roomSelector.getSelectedRooms();
            StatusManager.update(`Generating map for ${rooms.length} rooms...`);
            
            // Load saved coordinates if available
            this.loadSavedCoordinates();
            
            // Get UI state
            const uiState = this.uiManager.getUIState();
            
            // Prepare groups with names
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: uiState.groupData.names.get(index) || `Group ${index + 1}`
            }));
            
            // Build config for map generator
            const mapConfig = this.buildMapConfig(uiState, groupsWithNames);
            
            // Generate map and get group info
            const result = this.mapGenerator.generateMapWithGroups(rooms, mapConfig);
            const svg = result.svg;
            this.currentGroups = result.groups;
            this.applyPendingGroupData();
            
            // Save coordinates
            this.saveCurrentCoordinates();
            
            // Emit success event
            eventBus.emit(EVENTS.MAP_GENERATED, {
                svg,
                groups: this.currentGroups,
                roomCount: rooms.length
            });
            
            // Download the SVG file
            const outputName = document.getElementById('output-name').value;
            this.downloadSVG(svg, outputName);
            
            StatusManager.update(`Map generated! ${rooms.length} rooms in ${this.currentGroups.length} groups.`);
            
        } catch (error) {
            StatusManager.error(error.message);
        }
    }

    previewMap() {
        try {
            const rooms = this.roomSelector.getSelectedRooms();
            StatusManager.update(`Generating preview for ${rooms.length} rooms...`);
            
            // Load saved coordinates if available
            this.loadSavedCoordinates();
            
            // Get UI state
            const uiState = this.uiManager.getUIState();
            
            // Prepare groups with names
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: uiState.groupData.names.get(index) || `Group ${index + 1}`
            }));
            
            // Build config for map generator - always show group labels in preview
            const mapConfig = this.buildMapConfig(uiState, groupsWithNames);
            mapConfig.showGroupLabels = true;
            
            // Generate preview and get group info
            const result = this.mapGenerator.generateMapWithGroups(rooms, mapConfig);
            const svg = result.svg;
            this.currentGroups = result.groups;
            this.applyPendingGroupData();
            
            // Save coordinates
            this.saveCurrentCoordinates();
            
            // Emit success event
            eventBus.emit(EVENTS.MAP_GENERATED, {
                svg,
                groups: this.currentGroups,
                roomCount: rooms.length,
                isPreview: true
            });
            
            // Show preview in a new window
            this.showPreview(svg);
            
            StatusManager.update(`Preview generated for ${rooms.length} rooms in ${this.currentGroups.length} groups.`);
            
        } catch (error) {
            StatusManager.error(error.message);
        }
    }

    buildMapConfig(uiState, groupsWithNames) {
        return {
            edgeLength: this.config.edgeLength,
            roomShape: this.config.roomShape,
            roomSize: this.config.roomSize,
            strokeWidth: this.config.strokeWidth,
            connectionWidth: this.config.connectionWidth,
            colors: {
                default: this.config.colors.default,
                background: this.config.colors.background,
                connections: this.config.colors.connections,
                verticalConnections: this.config.colors.verticalConnections
            },
            tagColors: this.config.tagColors,
            showRoomIds: uiState.displayOptions.showRoomIds,
            showRoomNames: uiState.displayOptions.showRoomNames,
            showLabels: uiState.displayOptions.showLabels,
            showConnections: uiState.displayOptions.showConnections,
            showGroupLabels: uiState.displayOptions.showGroupLabels,
            groupOffsets: uiState.groupData.offsets,
            groupLabelOffsets: uiState.groupData.labelOffsets,
            groups: groupsWithNames,
            fonts: this.config.fonts,
            backgroundImage: this.config.backgroundImage,
            useBackground: this.config.useBackground,
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels,
            customTextBoxes: uiState.customTextBoxes
        };
    }

    applyPendingGroupData() {
        if (window.app.pendingGroupData) {
            const gp = window.app.pendingGroupData;
            const groupPanel = this.uiManager.panels.groupPositioning;
            
            // Set the current groups so the UI knows about them
            groupPanel.currentGroups = this.currentGroups;
            
            if (gp.offsets) {
                groupPanel.groupOffsets = new Map(gp.offsets);
            }
            if (gp.names) {
                groupPanel.groupNames = new Map(gp.names);
            }
            if (gp.labelOffsets) {
                groupPanel.groupLabelOffsets = new Map(gp.labelOffsets);
            }
            if (gp.labelBold) {
                groupPanel.groupLabelBold = new Map(gp.labelBold);
            }
            
            // Force UI update
            groupPanel.update();
            
            console.log('Applied pending group data after group creation');
        }
        
        // Apply other pending data
        if (window.app.pendingCrossConnections) {
            this.uiManager.panels.crossConnections.setConnections(window.app.pendingCrossConnections);
            delete window.app.pendingCrossConnections;
        }
        if (window.app.pendingCustomLabels) {
            this.uiManager.panels.customLabels.setLabels(window.app.pendingCustomLabels);
            delete window.app.pendingCustomLabels;
        }
        if (window.app.pendingCustomTextBoxes) {
            this.uiManager.panels.customTextBoxes.setTextBoxes(window.app.pendingCustomTextBoxes);
            delete window.app.pendingCustomTextBoxes;
        }
        
        // Clear main pending data
        delete window.app.pendingGroupData;
    }

    loadSavedCoordinates() {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const savedCoords = this.coordinateStorage.loadCoordinates(mapId, this.mapdbVersion);
        
        if (savedCoords) {
            console.log('Loading saved coordinates for', mapId);
            
            // Load data into UI panels
            const groupData = this.uiManager.panels.groupPositioning.getGroupData();
            groupData.offsets = new Map(savedCoords.groupOffsets || []);
            groupData.names = new Map(savedCoords.groupNames || []);
            groupData.labelOffsets = new Map(savedCoords.groupLabelOffsets || []);
            
            this.uiManager.panels.crossConnections.setConnections(savedCoords.crossGroupConnections || []);
            this.uiManager.panels.customLabels.setLabels(savedCoords.customLabels || []);
            this.uiManager.panels.customTextBoxes.setTextBoxes(savedCoords.customTextBoxes || []);
            
            return true;
        }

        return false;
    }

    saveCurrentCoordinates() {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const uiState = this.uiManager.getUIState();
        
        const coordData = {
            mapId: mapId,
            version: this.mapdbVersion,
            groupOffsets: Array.from(uiState.groupData.offsets.entries()),
            groupNames: Array.from(uiState.groupData.names.entries()),
            groupLabelOffsets: Array.from(uiState.groupData.labelOffsets.entries()),
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels,
            customTextBoxes: uiState.customTextBoxes,
            created: new Date().toISOString()
        };
        
        this.coordinateStorage.saveCoordinates(mapId, this.mapdbVersion, coordData);
        console.log('Saved coordinates for', mapId);
    }

    downloadSVG(svgContent, filename) {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showPreview(svgContent) {
        const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Map Preview</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #f0f0f0; 
                        font-family: Arial, sans-serif;
                    }
                    .map-container {
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        padding: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        overflow: auto;
                    }
                </style>
            </head>
            <body>
                <h3>Map Preview - Full Scale</h3>
                <p>Scroll to explore the entire map. Use browser zoom (Ctrl +/-) to adjust size.</p>
                <div class="map-container">
                    ${svgContent}
                </div>
            </body>
            </html>
        `);
    }
}