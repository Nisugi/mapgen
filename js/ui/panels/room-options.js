// Room Options Panel UI - handles room shape, size, border width, and default color
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class RoomOptionsPanel {
    constructor(config) {
        this.config = config;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Room shape select
        const roomShapeSelect = document.getElementById('room-shape');
        if (roomShapeSelect) {
            roomShapeSelect.addEventListener('change', (e) => {
                this.config.roomShape = e.target.value;
                this.emitConfigChange();
            });
        }

        // Room size slider
        this.setupSlider('room-size', 'room-size-value', 'px', (value) => {
            this.config.roomSize = parseInt(value);
            this.emitConfigChange();
        });

        // Room border width slider
        this.setupSlider('room-border-width', 'room-border-width-value', 'px', (value) => {
            this.config.strokeWidth = parseInt(value);
            this.emitConfigChange();
        });

        // Default room color
        this.setupColorInput('room-default-color', (value) => {
            this.config.colors.default = value;
            this.emitConfigChange();
        });
    }

    setupSlider(sliderId, valueId, unit, onChange) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        if (slider && valueSpan) {
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value + unit;
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

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { 
            config: this.config,
            section: 'room'
        });
    }

    // Get current room settings
    getRoomSettings() {
        return {
            shape: this.config.roomShape,
            size: this.config.roomSize,
            borderWidth: this.config.strokeWidth,
            defaultColor: this.config.colors.default
        };
    }

    // Set room settings (for config import)
    setRoomSettings(settings) {
        if (settings.shape) {
            this.config.roomShape = settings.shape;
            const shapeSelect = document.getElementById('room-shape');
            if (shapeSelect) shapeSelect.value = settings.shape;
        }

        if (settings.size) {
            this.config.roomSize = settings.size;
            this.updateSliderUI('room-size', 'room-size-value', settings.size, 'px');
        }

        if (settings.borderWidth) {
            this.config.strokeWidth = settings.borderWidth;
            this.updateSliderUI('room-border-width', 'room-border-width-value', settings.borderWidth, 'px');
        }

        if (settings.defaultColor) {
            this.config.colors.default = settings.defaultColor;
            const colorInput = document.getElementById('room-default-color');
            if (colorInput) colorInput.value = settings.defaultColor;
        }
    }

    updateSliderUI(sliderId, valueId, value, unit) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        if (slider) slider.value = value;
        if (valueSpan) valueSpan.textContent = value + unit;
    }
}