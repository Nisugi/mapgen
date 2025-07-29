// Edge Options Panel UI - handles edge length, connection width, and connection colors
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class EdgeOptionsPanel {
    constructor(config) {
        this.config = config;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Edge length slider
        this.setupSlider('edge-length', 'edge-length-value', 'px', (value) => {
            this.config.edgeLength = parseInt(value);
            this.emitConfigChange();
        });

        // Connection width slider
        this.setupSlider('connection-width', 'connection-width-value', 'px', (value) => {
            this.config.connectionWidth = parseInt(value);
            this.emitConfigChange();
        });

        // Connection color (default)
        this.setupColorInput('connection-default-color', (value) => {
            this.config.colors.connections = value;
            this.emitConfigChange();
        });

        // Vertical connection color
        this.setupColorInput('connection-vertical-color', (value) => {
            this.config.colors.verticalConnections = value;
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
            section: 'edges'
        });
    }

    // Get current edge settings
    getEdgeSettings() {
        return {
            length: this.config.edgeLength,
            connectionWidth: this.config.connectionWidth,
            connectionColor: this.config.colors.connections,
            verticalConnectionColor: this.config.colors.verticalConnections
        };
    }

    // Set edge settings (for config import)
    setEdgeSettings(settings) {
        if (settings.length) {
            this.config.edgeLength = settings.length;
            this.updateSliderUI('edge-length', 'edge-length-value', settings.length, 'px');
        }

        if (settings.connectionWidth) {
            this.config.connectionWidth = settings.connectionWidth;
            this.updateSliderUI('connection-width', 'connection-width-value', settings.connectionWidth, 'px');
        }

        if (settings.connectionColor) {
            this.config.colors.connections = settings.connectionColor;
            const colorInput = document.getElementById('connection-default-color');
            if (colorInput) colorInput.value = settings.connectionColor;
        }

        if (settings.verticalConnectionColor) {
            this.config.colors.verticalConnections = settings.verticalConnectionColor;
            const colorInput = document.getElementById('connection-vertical-color');
            if (colorInput) colorInput.value = settings.verticalConnectionColor;
        }
    }

    updateSliderUI(sliderId, valueId, value, unit) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        if (slider) slider.value = value;
        if (valueSpan) valueSpan.textContent = value + unit;
    }
}