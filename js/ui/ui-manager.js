// Main UI Manager - coordinates all UI panels
import { eventBus, EVENTS } from '../utils/event-bus.js';
import { RoomSelectionPanel } from './panels/room-selection.js';
import { ThemeColorsPanel } from './panels/theme-colors.js';
import { DisplayOptionsPanel } from './panels/display-options.js';
import { FontSettingsPanel } from './panels/font-settings.js';
import { GroupPositioningPanel } from './panels/group-positioning.js';
import { CrossConnectionsPanel } from './panels/cross-connections.js';
import { CustomLabelsPanel } from './panels/custom-labels.js';

export class UIManager {
    constructor(config, mapdbLoader, mapdb) {
        this.config = config;
        this.mapdbLoader = mapdbLoader;
        this.mapdb = mapdb;
        
        // Initialize all panels
        this.panels = {
            roomSelection: new RoomSelectionPanel(mapdbLoader, mapdb),
            themeColors: new ThemeColorsPanel(config, mapdbLoader, mapdb),
            displayOptions: new DisplayOptionsPanel(config),
            fontSettings: new FontSettingsPanel(config),
            groupPositioning: new GroupPositioningPanel(),
            crossConnections: new CrossConnectionsPanel(config),
            customLabels: new CustomLabelsPanel(config)
        };
    }

    init() {
        // Initialize all panels
        Object.values(this.panels).forEach(panel => panel.init());
        
        // Setup main UI event listeners
        this.setupMainButtons();
    }

    setupMainButtons() {
        // Generate button
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.MAP_GENERATE);
            });
        }

        // Preview button
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.MAP_PREVIEW);
            });
        }

        // Export coordinates button
        const exportCoordsBtn = document.getElementById('export-coords-btn');
        if (exportCoordsBtn) {
            exportCoordsBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.EXPORT_COORDS);
            });
        }
    }

    showMainInterface() {
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.classList.remove('hidden');
        }
        
        const generateBtn = document.getElementById('generate-btn');
        const previewBtn = document.getElementById('preview-btn');
        
        if (generateBtn) generateBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
    }

    // Get current UI state
    getUIState() {
        return {
            roomSelection: {
                method: this.panels.roomSelection.getSelectionMethod(),
                locations: this.panels.roomSelection.getSelectedLocations(),
                customRanges: this.panels.roomSelection.getCustomRanges(),
                exclusions: this.panels.roomSelection.getExclusions()
            },
            displayOptions: this.panels.displayOptions.getOptions(),
            groupData: this.panels.groupPositioning.getGroupData(),
            crossConnections: this.panels.crossConnections.getConnections(),
            customLabels: this.panels.customLabels.getLabels()
        };
    }

    // Restore UI state
    setUIState(state) {
        // This would be called when loading a saved configuration
        // Each panel would need a method to restore its state
    }
}