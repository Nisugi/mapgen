// Main Application - coordinates all modules
import { MapDBLoader } from './mapdb-loader.js';
import { MapGenerator } from './map-generator.js';
import { GitHubIntegration } from './github/github-integration.js';
import { CoordinateStorage } from './data/coordinate-storage.js';
import { RoomSelector } from './data/room-selector.js';
import { UIManager } from './ui/ui-manager.js';
import { StatusManager } from './utils/status-manager.js';
import { eventBus, EVENTS } from './utils/event-bus.js';
import { MapGeneratorManager } from './map-generator-manager.js';
import { ExportManager } from './export/export-manager.js';
import { DEFAULT_CONFIG, createConfig } from './config/default-config.js';

class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.mapdbVersion = null;
        this.mapdbLoader = new MapDBLoader();
        this.config = createConfig();
        this.currentGroups = [];
        
        // Initialize services
        this.coordinateStorage = new CoordinateStorage();
        this.github = new GitHubIntegration();
        this.statusManager = new StatusManager();
        this.roomSelector = null;
        this.uiManager = null;
        this.mapGeneratorManager = null;
        this.exportManager = null;
        
        // Make available globally for UI callbacks
        window.app = this;
        
        this.init();
    }

    async init() {
        try {
            // Initialize status manager
            this.statusManager.init();
            
            // Load MapDB
            await this.loadMapDB();
            
            // Initialize services that depend on MapDB
            this.roomSelector = new RoomSelector(this.mapdbLoader, this.mapdb);
            this.uiManager = new UIManager(this.config, this.mapdbLoader, this.mapdb);
            
            // Initialize map generator
            const mapGenerator = new MapGenerator();
            this.mapGeneratorManager = new MapGeneratorManager(
                this.config,
                this.roomSelector,
                this.uiManager,
                this.coordinateStorage
            );
            this.mapGeneratorManager.setMapGenerator(mapGenerator);
            this.mapGeneratorManager.setMapDBVersion(this.mapdbVersion);
            
            // Initialize export manager
            this.exportManager = new ExportManager(
                this.config,
                this.roomSelector,
                this.uiManager,
                mapGenerator,
                this.mapdbVersion
            );
            
            // Make export methods available globally for UI
            window.app.exportManager = this.exportManager;
            window.app.groupPositioningPanel = this.uiManager.panels.groupPositioning;
            
            // Initialize UI
            this.uiManager.init();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup GitHub UI
            this.setupGitHubUI();
            this.checkGitHubAuth();
            
            // Show main interface
            this.showMainInterface();
            
        } catch (error) {
            this.statusManager.error('Failed to initialize application: ' + error.message);
        }
    }

    async loadMapDB() {
        try {
            const result = await this.mapdbLoader.loadMapDB(
                (percent, loaded, total, message) => {
                    this.statusManager.progress(percent, message);
                }
            );

            this.mapdb = result.data;
            this.mapdbVersion = result.version;

            console.log(`MapDB loaded: ${this.mapdb.length} rooms from version ${this.mapdbVersion}`);
            
        } catch (error) {
            throw new Error('Failed to load MapDB: ' + error.message);
        }
    }

    setupEventListeners() {
        // Listen for config changes
        eventBus.on(EVENTS.CONFIG_CHANGED, (data) => {
            console.log('Config changed:', data);
            // Config is already updated by the panels
        });

        // Listen for map generation success
        eventBus.on(EVENTS.MAP_GENERATED, (data) => {
            this.currentGroups = data.groups;
            // Groups panel will update itself
        });

        // Listen for coordinate export requests
        eventBus.on(EVENTS.EXPORT_COORDS, () => {
            this.exportManager.exportCoordinates();
        });

        // Listen for group/connection/label changes to save coordinates
        const saveEvents = [
            EVENTS.GROUP_OFFSET_CHANGED,
            EVENTS.GROUP_NAME_CHANGED,
            EVENTS.GROUP_LABEL_OFFSET_CHANGED,
            EVENTS.CROSS_CONNECTION_ADDED,
            EVENTS.CROSS_CONNECTION_REMOVED,
            EVENTS.CROSS_CONNECTION_UPDATED,
            EVENTS.CUSTOM_LABEL_ADDED,
            EVENTS.CUSTOM_LABEL_REMOVED,
            EVENTS.CUSTOM_LABEL_UPDATED
        ];

        saveEvents.forEach(event => {
            eventBus.on(event, () => {
                this.mapGeneratorManager.saveCurrentCoordinates();
            });
        });
    }

    showMainInterface() {
        this.uiManager.showMainInterface();
        this.statusManager.hideProgress();
        this.statusManager.update(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
    }

    // GitHub Integration Methods (these remain similar but use the modular components)
    setupGitHubUI() {
        // Update GitHub status in UI
        this.updateGitHubStatus();
        
        // Add GitHub event listeners
        const githubLoginBtn = document.getElementById('github-login');
        if (githubLoginBtn) {
            githubLoginBtn.addEventListener('click', this.handleGitHubLogin.bind(this));
        }

        const saveToGitHubBtn = document.getElementById('save-to-github');
        if (saveToGitHubBtn) {
            saveToGitHubBtn.addEventListener('click', this.showSaveDialog.bind(this));
        }

        const loadFromGitHubBtn = document.getElementById('load-from-github');
        if (loadFromGitHubBtn) {
            loadFromGitHubBtn.addEventListener('click', this.showLoadDialog.bind(this));
        }
    }

    async checkGitHubAuth() {
        // Check if we're returning from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('code')) {
            try {
                await this.github.handleAuthCallback();
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                this.updateGitHubStatus();
            } catch (error) {
                console.error('OAuth callback failed:', error);
                this.statusManager.error('GitHub authentication failed: ' + error.message);
            }
        } else if (this.github.isAuthenticated()) {
            // Verify existing token
            try {
                await this.github.getCurrentUser();
                this.updateGitHubStatus();
            } catch (error) {
                console.warn('GitHub token verification failed:', error);
                this.github.clearToken();
                this.updateGitHubStatus();
            }
        }
    }

    updateGitHubStatus() {
        const authSection = document.querySelector('.github-auth-section');
        const loginBtn = document.getElementById('github-login');
        const userInfo = document.getElementById('github-user-info');
        const githubActions = document.querySelector('.github-actions');
        
        if (!authSection) return; // UI not ready yet

        const status = this.github.getAuthStatus();
        
        if (status.authenticated && status.user) {
            loginBtn.textContent = 'Reconnect GitHub';
            loginBtn.className = 'btn-small btn-secondary';
            
            if (userInfo) {
                userInfo.innerHTML = `
                    <span>✅ ${status.user.login}</span>
                    <button id="github-logout" class="btn-small">Logout</button>
                `;
                userInfo.classList.remove('hidden');
                
                // Re-add logout listener
                const logoutBtn = document.getElementById('github-logout');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', this.handleGitHubLogout.bind(this));
                }
            }
            
            if (githubActions) {
                githubActions.classList.remove('hidden');
            }
        } else {
            loginBtn.textContent = 'Connect GitHub';
            loginBtn.className = 'btn-small btn-primary';
            
            if (userInfo) {
                userInfo.classList.add('hidden');
            }
            
            if (githubActions) {
                githubActions.classList.add('hidden');
            }
        }
    }

    async handleGitHubLogin() {
        try {
            this.statusManager.update('Connecting to GitHub...');
            await this.github.authenticate();
        } catch (error) {
            this.statusManager.error('GitHub login failed: ' + error.message);
        }
    }

    handleGitHubLogout() {
        this.github.clearToken();
        this.updateGitHubStatus();
        this.statusManager.update('Logged out of GitHub');
    }

    showSaveDialog() {
        // TODO: Implement save dialog using a modal manager
        alert('Save dialog would appear here - implementation pending');
    }

    showLoadDialog() {
        // TODO: Implement load dialog using a modal manager
        alert('Load dialog would appear here - implementation pending');
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapApp = new MapGenApp();
});