// Modal Manager - handles generic modal creation and management
export class ModalManager {
    constructor() {
        this.activeModals = new Set();
    }

    createModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const {
            title = 'Modal',
            size = 'normal', // 'normal' or 'large'
            closable = true,
            onClose = null
        } = options;
        
        const sizeClass = size === 'large' ? 'large-modal' : '';
        
        modal.innerHTML = `
            <div class="modal-overlay" ${closable ? `onclick="this.parentElement.remove()"` : ''}></div>
            <div class="modal-content ${sizeClass}">
                <h3>${title}</h3>
                ${content}
            </div>
        `;
        
        // Add to active modals tracking
        this.activeModals.add(modal);
        
        // Handle cleanup when modal is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === modal) {
                        this.activeModals.delete(modal);
                        observer.disconnect();
                        if (onClose) onClose();
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true });
        
        return modal;
    }

    createSaveModal(mapName, description = '') {
        const content = `
            <div class="form-group">
                <label for="save-map-name">Map Name:</label>
                <input type="text" id="save-map-name" value="${mapName}" 
                       placeholder="Enter map name">
            </div>
            <div class="form-group">
                <label for="save-description">Description (optional):</label>
                <textarea id="save-description" placeholder="Describe your map..." rows="3">${description}</textarea>
            </div>
            <div class="form-group">
                <label>Files to save:</label>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="save-svg" checked> SVG Map</label>
                    <label><input type="checkbox" id="save-coords" checked> Coordinates</label>
                    <label><input type="checkbox" id="save-config" checked> Configuration</label>
                </div>
            </div>
            <div class="save-status"></div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" onclick="window.app.githubUI.saveToGitHub(this)">Save to GitHub</button>
            </div>
        `;
        
        return this.createModal(content, {
            title: '💾 Save Map to GitHub',
            closable: true
        });
    }

    createLoadModal() {
        const content = `
            <div class="map-gallery">
                <p class="loading">Loading maps from GitHub...</p>
            </div>
            <div class="load-status"></div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" id="load-selected-map" disabled onclick="window.app.githubUI.loadFromGitHub(this)">
                    Load Selected Map
                </button>
            </div>
        `;
        
        return this.createModal(content, {
            title: '📂 Load Map from GitHub',
            size: 'large',
            closable: true
        });
    }

    createStatusModal(title, message, type = 'info') {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        const content = `
            <div class="form-group">
                <p style="text-align: center; font-size: 1.2em;">
                    ${icons[type]} ${message}
                </p>
            </div>
            <div class="modal-actions">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">OK</button>
            </div>
        `;
        
        return this.createModal(content, {
            title: title,
            closable: true
        });
    }

    closeAllModals() {
        this.activeModals.forEach(modal => {
            if (modal.parentNode) {
                modal.remove();
            }
        });
        this.activeModals.clear();
    }

    getModalElement(selector) {
        // Helper to find elements within the most recently created modal
        const modals = Array.from(this.activeModals);
        if (modals.length === 0) return null;
        
        const latestModal = modals[modals.length - 1];
        return latestModal.querySelector(selector);
    }
}