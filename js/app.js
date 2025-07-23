// Main application controller
class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.config = this.getDefaultConfig();
        this.init();
    }

    getDefaultConfig() {
        return {
            theme: 'maritime',
            colors: {
                default: '#ffffff',
                water: '#8cc6ff',
                exit: '#ff6b6b',
                shop: '#90EE90'
            },
            options: {
                showRoomIds: true,
                showLabels: true,
                showConnections: true,
                debugMode: false,
                gridSize: 50
            }
        };
    }

    async init() {
        this.updateStatus('Initializing application...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load MapDB
        await this.loadMapDB();
        
        // Show main interface
        this.showMainInterface();
    }

    setupEventListeners() {
        // We'll add these in the next step
        console.log('Setting up event listeners...');
    }

    async loadMapDB() {
        this.updateStatus('Loading MapDB from GitHub...');
        // This will use our mapdb-loader.js
        console.log('Loading MapDB...');
    }

    showMainInterface() {
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('generate-btn').disabled = false;
        document.getElementById('preview-btn').disabled = false;
        this.updateStatus('Ready to generate maps!');
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MapGenApp();
});