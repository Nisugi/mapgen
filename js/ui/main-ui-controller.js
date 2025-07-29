// Main UI Controller - handles main buttons and core UI interactions
import { eventBus, EVENTS } from '../utils/event-bus.js';

export class MainUIController {
    constructor() {
        // No dependencies needed
    }

    init() {
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

    hideMainInterface() {
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.classList.add('hidden');
        }
    }

    enableMainButtons() {
        const generateBtn = document.getElementById('generate-btn');
        const previewBtn = document.getElementById('preview-btn');
        
        if (generateBtn) generateBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
    }

    disableMainButtons() {
        const generateBtn = document.getElementById('generate-btn');
        const previewBtn = document.getElementById('preview-btn');
        
        if (generateBtn) generateBtn.disabled = true;
        if (previewBtn) previewBtn.disabled = true;
    }
}