// Font Settings Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class FontSettingsPanel {
    constructor(config) {
        this.config = config;
    }

    init() {
        this.setupLabelFonts();
        this.setupRoomFonts();
    }

    setupLabelFonts() {
        // Label font size
        this.setupFontSlider('label-font-size', 'label-font-size-value', (value) => {
            this.config.fonts.labels.size = parseInt(value);
            this.emitConfigChange();
        });

        // Label font color
        this.setupColorInput('label-font-color', (value) => {
            this.config.fonts.labels.color = value;
            this.emitConfigChange();
        });

        // Label font family
        this.setupSelect('label-font-family', (value) => {
            this.config.fonts.labels.family = value;
            this.emitConfigChange();
        });

        // Label font bold
        this.setupCheckbox('label-font-bold', (checked) => {
            this.config.fonts.labels.bold = checked;
            this.emitConfigChange();
        });
    }

    setupRoomFonts() {
        // Room font size
        this.setupFontSlider('room-font-size', 'room-font-size-value', (value) => {
            this.config.fonts.rooms.size = parseInt(value);
            this.emitConfigChange();
        });

        // Room font color
        this.setupColorInput('room-font-color', (value) => {
            this.config.fonts.rooms.color = value;
            this.emitConfigChange();
        });

        // Room font family
        this.setupSelect('room-font-family', (value) => {
            this.config.fonts.rooms.family = value;
            this.emitConfigChange();
        });

        // Room font bold
        this.setupCheckbox('room-font-bold', (checked) => {
            this.config.fonts.rooms.bold = checked;
            this.emitConfigChange();
        });
    }

    setupFontSlider(sliderId, valueId, onChange) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        if (slider && valueSpan) {
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value + 'px';
                onChange(e.target.value);
            });
        }
    }

    setupColorInput(inputId, onChange) {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => onChange(e.target.value));
        }
    }

    setupSelect(selectId, onChange) {
        const select = document.getElementById(selectId);
        if (select) {
            select.addEventListener('change', (e) => onChange(e.target.value));
        }
    }

    setupCheckbox(checkboxId, onChange) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => onChange(e.target.checked));
        }
    }

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { 
            config: this.config,
            section: 'fonts'
        });
    }

    getFontSettings() {
        return {
            labels: { ...this.config.fonts.labels },
            rooms: { ...this.config.fonts.rooms }
        };
    }

    setFontSettings(fonts) {
        if (fonts.labels) {
            this.config.fonts.labels = { ...this.config.fonts.labels, ...fonts.labels };
            this.updateLabelFontUI(fonts.labels);
        }
        
        if (fonts.rooms) {
            this.config.fonts.rooms = { ...this.config.fonts.rooms, ...fonts.rooms };
            this.updateRoomFontUI(fonts.rooms);
        }
    }

    updateLabelFontUI(settings) {
        if (settings.size) {
            const slider = document.getElementById('label-font-size');
            const value = document.getElementById('label-font-size-value');
            if (slider) slider.value = settings.size;
            if (value) value.textContent = settings.size + 'px';
        }
        
        if (settings.color) {
            const input = document.getElementById('label-font-color');
            if (input) input.value = settings.color;
        }
        
        if (settings.family) {
            const select = document.getElementById('label-font-family');
            if (select) select.value = settings.family;
        }
        
        if (settings.bold !== undefined) {
            const checkbox = document.getElementById('label-font-bold');
            if (checkbox) checkbox.checked = settings.bold;
        }
    }

    updateRoomFontUI(settings) {
        if (settings.size) {
            const slider = document.getElementById('room-font-size');
            const value = document.getElementById('room-font-size-value');
            if (slider) slider.value = settings.size;
            if (value) value.textContent = settings.size + 'px';
        }
        
        if (settings.color) {
            const input = document.getElementById('room-font-color');
            if (input) input.value = settings.color;
        }
        
        if (settings.family) {
            const select = document.getElementById('room-font-family');
            if (select) select.value = settings.family;
        }
        
        if (settings.bold !== undefined) {
            const checkbox = document.getElementById('room-font-bold');
            if (checkbox) checkbox.checked = settings.bold;
        }
    }
}