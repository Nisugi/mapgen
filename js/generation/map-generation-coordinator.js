// Map Generation Coordinator - coordinates map generation workflow
import { eventBus, EVENTS } from '../utils/event-bus.js';
import { StatusManager } from '../utils/status-manager.js';
import { CoordinateManager } from '../data/coordinate-manager.js';
import { PreviewManager } from '../utils/preview-manager.js';

export class MapGenerationCoordinator {
    constructor(config, roomSelector, panelManager, coordinateStorage) {
        this.config = config;
        this.roomSelector = roomSelector;
        this.panelManager = panelManager;
        this.mapGenerator = null; // Will be set by main app
        this.currentGroups = [];
        
        // Initialize sub-managers
        this.coordinateManager = new CoordinateManager(coordinateStorage, roomSelector, panelManager);
        this.previewManager = new PreviewManager();
        
        // Listen for generation events
        eventBus.on(EVENTS.MAP_GENERATE, this.generateMap.bind(this));
        eventBus.on(EVENTS.MAP_PREVIEW, this.previewMap.bind(this));
    }

    setMapGenerator(generator) {
        this.mapGenerator = generator;
    }

    setMapDBVersion(version) {
        this.coordinateManager.setMapDBVersion(version);
    }

    generateMap() {
        try {
            const rooms = this.roomSelector.getSelectedRooms();
            StatusManager.update(`Generating map for ${rooms.length} rooms...`);
            
            // Load saved coordinates if available
            this.coordinateManager.loadSavedCoordinates();
            
            // Get UI state
            const uiState = this.panelManager.getUIState();;;
            
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
            this.coordinateManager.saveCurrentCoordinates();
            
            // Emit success event
            eventBus.emit(EVENTS.MAP_GENERATED, {
                svg,
                groups: this.currentGroups,
                roomCount: rooms.length
            });
            
            // Download the SVG file
            const outputName = document.getElementById('output-name').value;
            this.previewManager.downloadSVG(svg, outputName);
            
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
            this.coordinateManager.loadSavedCoordinates();
            
            // Get UI state
            const uiState = this.panelManager.getUIState();
            
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
            this.coordinateManager.saveCurrentCoordinates();
            
            // Emit success event
            eventBus.emit(EVENTS.MAP_GENERATED, {
                svg,
                groups: this.currentGroups,
                roomCount: rooms.length,
                isPreview: true
            });
            
            // Show preview in a new window
            this.previewManager.showPreview(svg);
            
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
            const groupPanel = this.panelManager.panels.groupPositioning;
            
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
            this.panelManager.panels.crossConnections.setConnections(window.app.pendingCrossConnections);
            delete window.app.pendingCrossConnections;
        }
        if (window.app.pendingCustomLabels) {
            this.panelManager.panels.customLabels.setLabels(window.app.pendingCustomLabels);
            delete window.app.pendingCustomLabels;
        }
        if (window.app.pendingCustomTextBoxes) {
            this.panelManager.panels.customTextBoxes.setTextBoxes(window.app.pendingCustomTextBoxes);
            delete window.app.pendingCustomTextBoxes;
        }
        
        // Clear main pending data
        delete window.app.pendingGroupData;
    }

    // Expose coordinate manager methods for backward compatibility
    saveCurrentCoordinates() {
        this.coordinateManager.saveCurrentCoordinates();
    }

    loadSavedCoordinates() {
        return this.coordinateManager.loadSavedCoordinates();
    }

    // Getter for current groups
    getCurrentGroups() {
        return this.currentGroups;
    }
}