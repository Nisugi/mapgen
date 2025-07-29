// Background Options Panel UI - handles background color, image upload, and clear image
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class BackgroundOptionsPanel {
    constructor(config) {
        this.config = config;
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Use background checkbox
        const useBackgroundCheckbox = document.getElementById('use-background');
        if (useBackgroundCheckbox) {
            useBackgroundCheckbox.addEventListener('change', (e) => {
                this.config.useBackground = e.target.checked;
                this.emitConfigChange();
            });
        }

        // Background color
        this.setupColorInput('background-color', (value) => {
            this.config.colors.background = value;
            this.emitConfigChange();
        });

        // Background image upload
        const backgroundImageInput = document.getElementById('background-image');
        if (backgroundImageInput) {
            backgroundImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.config.backgroundImage = event.target.result;
                        this.emitConfigChange();
                        this.updateImageStatus(file.name);
                    };
                    reader.readAsDataURL(file);
                } else if (file) {
                    alert('Please select a valid image file');
                    e.target.value = '';
                }
            });
        }

        // Clear background image
        const clearBackgroundBtn = document.getElementById('clear-background');
        if (clearBackgroundBtn) {
            clearBackgroundBtn.addEventListener('click', () => {
                this.config.backgroundImage = null;
                if (backgroundImageInput) backgroundImageInput.value = '';
                this.updateImageStatus(null);
                this.emitConfigChange();
            });
        }
    }

    setupColorInput(inputId, onChange) {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => onChange(e.target.value));
        }
    }

    updateImageStatus(filename) {
        const statusElement = document.getElementById('background-image-status');
        if (statusElement) {
            if (filename) {
                statusElement.textContent = `Image: ${filename}`;
                statusElement.style.color = '#27ae60';
            } else {
                statusElement.textContent = 'No image selected';
                statusElement.style.color = '#666';
            }
        }
    }

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { 
            config: this.config,
            section: 'background'
        });
    }

    // Get current background settings
    getBackgroundSettings() {
        return {
            useBackground: this.config.useBackground,
            backgroundColor: this.config.colors.background,
            backgroundImage: this.config.backgroundImage
        };
    }

    // Set background settings (for config import)
    setBackgroundSettings(settings) {
        if (settings.useBackground !== undefined) {
            this.config.useBackground = settings.useBackground;
            const checkbox = document.getElementById('use-background');
            if (checkbox) checkbox.checked = settings.useBackground;
        }

        if (settings.backgroundColor) {
            this.config.colors.background = settings.backgroundColor;
            const colorInput = document.getElementById('background-color');
            if (colorInput) colorInput.value = settings.backgroundColor;
        }

        if (settings.backgroundImage) {
            this.config.backgroundImage = settings.backgroundImage;
            this.updateImageStatus('Imported image');
        } else if (settings.backgroundImage === null) {
            this.config.backgroundImage = null;
            const imageInput = document.getElementById('background-image');
            if (imageInput) imageInput.value = '';
            this.updateImageStatus(null);
        }
    }
}