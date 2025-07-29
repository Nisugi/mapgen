// Theme Presets Panel UI - handles theme preset selection only
import { eventBus, EVENTS } from '../../utils/event-bus.js';
import { THEME_PRESETS } from '../../config/theme-presets.js';

export class ThemePresetsPanel {
    constructor(config, panelManager) {
        this.config = config;
        this.panelManager = panelManager;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Theme preset dropdown
        const themePreset = document.getElementById('theme-preset');
        if (themePreset) {
            themePreset.addEventListener('change', this.applyThemePreset.bind(this));
        }
    }

    applyThemePreset(e) {
        const theme = THEME_PRESETS[e.target.value];
        if (theme) {
            // Apply colors to config
            this.config.colors = { 
                default: theme.default,
                background: theme.background,
                connections: theme.connections,
                verticalConnections: theme.verticalConnections
            };
            
            // Apply tag colors
            if (theme.tagColors instanceof Map) {
                this.config.tagColors = new Map(theme.tagColors);
            } else {
                this.config.tagColors = new Map();
            }
            
            // Update all sub-panels with new theme values
            this.updateSubPanels(theme);
            this.emitConfigChange();
            
            eventBus.emit(EVENTS.THEME_CHANGED, { theme: e.target.value });
        }
    }

    updateSubPanels(theme) {
        // Update room options panel
        if (this.panelManager.panels.roomOptions) {
            this.panelManager.panels.roomOptions.setRoomSettings({
                defaultColor: theme.default
            });
        }
         // Update edge options panel
        if (this.panelManager.panels.edgeOptions) {
            this.panelManager.panels.edgeOptions.setEdgeSettings({
                connectionColor: theme.connections,
                verticalConnectionColor: theme.verticalConnections
            });
        }
         // Update background options panel
        if (this.panelManager.panels.backgroundOptions) {
            this.panelManager.panels.backgroundOptions.setBackgroundSettings({
                backgroundColor: theme.background
            });
        }
         // Update tag colors panel
        if (this.panelManager.panels.tagColors) {
            this.panelManager.panels.tagColors.setTagColors(theme.tagColors);
        }
    }

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { config: this.config });
    }
}