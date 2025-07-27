// Status and progress management
import { eventBus, EVENTS } from './event-bus.js';

export class StatusManager {
    constructor() {
        this.statusElement = null;
        this.progressContainer = null;
        this.progressFill = null;
        this.progressText = null;
        
        // Listen for status events
        eventBus.on(EVENTS.STATUS_UPDATE, this.updateStatus.bind(this));
        eventBus.on(EVENTS.PROGRESS_UPDATE, this.updateProgress.bind(this));
        eventBus.on(EVENTS.ERROR, this.showError.bind(this));
    }

    init() {
        this.statusElement = document.getElementById('status-text');
        this.progressContainer = document.getElementById('progress-container');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
    }

    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
    }

    showProgress() {
        if (this.progressContainer) {
            this.progressContainer.classList.remove('hidden');
        }
    }

    updateProgress({ percent, message }) {
        if (!this.progressContainer) return;
        
        this.progressContainer.classList.remove('hidden');
        
        if (this.progressFill) {
            this.progressFill.style.width = percent + '%';
        }
        
        if (this.progressText) {
            this.progressText.textContent = percent + '%';
        }
        
        if (message) {
            this.updateStatus(message);
        }
    }

    hideProgress() {
        if (this.progressContainer) {
            this.progressContainer.classList.add('hidden');
        }
    }

    showError(message) {
        this.updateStatus('❌ ' + message);
        this.hideProgress();
        console.error(message);
    }

    // Convenience methods that emit events
    static update(message) {
        eventBus.emit(EVENTS.STATUS_UPDATE, message);
    }

    static progress(percent, message = null) {
        eventBus.emit(EVENTS.PROGRESS_UPDATE, { percent, message });
    }

    static error(message) {
        eventBus.emit(EVENTS.ERROR, message);
    }
}