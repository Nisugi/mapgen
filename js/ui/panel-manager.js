// Panel Manager - coordinates all UI panels and state
import { eventBus, EVENTS } from '../utils/event-bus.js';
import { RoomSelectionPanel } from './panels/room-selection.js';
import { ThemePresetsPanel } from './panels/theme-colors.js';
import { RoomOptionsPanel } from './panels/room-options.js';
import { EdgeOptionsPanel } from './panels/edge-options.js';
import { BackgroundOptionsPanel } from './panels/background-options.js';
import { TagColorsPanel } from './panels/tag-colors.js';
import { DisplayOptionsPanel } from './panels/display-options.js';
import { FontSettingsPanel } from './panels/font-settings.js';
import { GroupPositioningPanel } from './panels/group-positioning.js';
import { CrossConnectionsPanel } from './panels/cross-connections.js';
import { CustomLabelsPanel } from './panels/custom-labels.js';
import { CustomTextBoxesPanel } from './panels/custom-textboxes.js';
import { UIStateManager } from './ui-state-manager.js';
import { MainUIController } from './main-ui-controller.js';
import { TabController } from './tab-controller.js';

export class PanelManager {
    constructor(config, mapdbLoader, mapdb) {
        this.config = config;
        this.mapdbLoader = mapdbLoader;
        this.mapdb = mapdb;
        
        // Initialize all panels
        this.panels = {
            roomSelection: new RoomSelectionPanel(mapdbLoader, mapdb),
            themePresets: new ThemePresetsPanel(config, this),
            roomOptions: new RoomOptionsPanel(config),
            edgeOptions: new EdgeOptionsPanel(config),
            backgroundOptions: new BackgroundOptionsPanel(config),
            tagColors: new TagColorsPanel(config, mapdbLoader, mapdb),
            displayOptions: new DisplayOptionsPanel(config),
            fontSettings: new FontSettingsPanel(config),
            groupPositioning: new GroupPositioningPanel(),
            crossConnections: new CrossConnectionsPanel(config),
            customLabels: new CustomLabelsPanel(config),
            customTextBoxes: new CustomTextBoxesPanel(config)
        };

        // Initialize state manager and main UI controller
        this.uiStateManager = new UIStateManager(this.panels);
        this.mainUIController = new MainUIController();
        this.tabController = new TabController();
    }

    init() {
        // Initialize all panels
        Object.values(this.panels).forEach(panel => panel.init());
        
        // Initialize main UI controller
        this.mainUIController.init();

        // Initialize tab controller
        this.tabController.init();

        // Set initial edge length for group positioning
        this.panels.groupPositioning.setEdgeLength(this.config.edgeLength);
        
        // Listen for config changes to update edge length
        eventBus.on(EVENTS.CONFIG_CHANGED, (data) => {
            if (data.config && data.config.edgeLength !== undefined) {
                this.panels.groupPositioning.updateEdgeLength(data.config.edgeLength);
            }
        });
    }

    // Delegate UI state methods to state manager
    getUIState() {
        return this.uiStateManager.getUIState();
    }

    setUIState(state) {
        this.uiStateManager.setUIState(state);
    }

    // Delegate main interface methods to main UI controller
    showMainInterface() {
        this.mainUIController.showMainInterface();
    }

    hideMainInterface() {
        this.mainUIController.hideMainInterface();
    }

    enableMainButtons() {
        this.mainUIController.enableMainButtons();
    }

    disableMainButtons() {
        this.mainUIController.disableMainButtons();
    }

    // Panel access methods for backward compatibility
    getPanels() {
        return this.panels;
    }

    getPanel(panelName) {
        return this.panels[panelName];
    }
}