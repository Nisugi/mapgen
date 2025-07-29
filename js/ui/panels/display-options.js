// Display Options Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class DisplayOptionsPanel {
    constructor(config) {
        this.config = config;
        this.checkboxes = {};
    }

    init() {
        this.setupCheckboxes();
        this.setupOutputSettings();
    }

    setupCheckboxes() {
        const checkboxIds = [
            'show-room-ids',
            'show-room-names',
            'show-cardinal-labels',
            'show-labels',
            'show-connections',
            'show-group-labels'
        ];

        checkboxIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                this.checkboxes[id] = checkbox;
                
                // Set initial state from config
                const configKey = this.getConfigKey(id);
                if (configKey && this.config.options[configKey] !== undefined) {
                    checkbox.checked = this.config.options[configKey];
                }
                
                // Add change listener
                checkbox.addEventListener('change', () => {
                    this.handleCheckboxChange(id, checkbox.checked);
                });
            }
        });
    }

    setupOutputSettings() {
        const outputName = document.getElementById('output-name');
        if (outputName) {
            outputName.addEventListener('blur', () => {
                // Auto-sanitize filename
                outputName.value = outputName.value.replace(/[^a-zA-Z0-9_-]/g, '_');
            });
        }
    }

    getConfigKey(checkboxId) {
        const mapping = {
            'show-room-ids': 'showRoomIds',
            'show-room-names': 'showRoomNames',
            'show-cardinal-labels': 'showCardinalLabels',
            'show-labels': 'showLabels',
            'show-connections': 'showConnections',
            'show-group-labels': 'showGroupLabels'
        };
        return mapping[checkboxId];
    }

    handleCheckboxChange(checkboxId, checked) {
        const configKey = this.getConfigKey(checkboxId);
        if (configKey) {
            this.config.options[configKey] = checked;
            eventBus.emit(EVENTS.CONFIG_CHANGED, { 
                config: this.config,
                option: configKey,
                value: checked
            });
        }
    }

    getOptions() {
        return {
            showRoomIds: this.checkboxes['show-room-ids']?.checked ?? true,
            showRoomNames: this.checkboxes['show-room-names']?.checked ?? false,
            showLabels: this.checkboxes['show-labels']?.checked ?? true,
            showConnections: this.checkboxes['show-connections']?.checked ?? true,
            showGroupLabels: this.checkboxes['show-group-labels']?.checked ?? false
        };
    }

    setOptions(options) {
        Object.entries(options).forEach(([key, value]) => {
            const checkboxId = Object.entries({
                'show-room-ids': 'showRoomIds',
                'show-room-names': 'showRoomNames',
                'show-labels': 'showLabels',
                'show-connections': 'showConnections',
                'show-group-labels': 'showGroupLabels'
            }).find(([id, configKey]) => configKey === key)?.[0];
            
            if (checkboxId && this.checkboxes[checkboxId]) {
                this.checkboxes[checkboxId].checked = value;
            }
        });
    }

    getOutputName() {
        const outputName = document.getElementById('output-name');
        return outputName ? outputName.value : 'elanthia_map';
    }

    setOutputName(name) {
        const outputName = document.getElementById('output-name');
        if (outputName) {
            outputName.value = name;
        }
    }
}