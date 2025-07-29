// Main Application Core - coordinates all modules
import { MapDBLoader } from './mapdb-loader.js';
import { MapGenerator } from './map-generator.js';
import { GitHubIntegration } from './github/github-integration.js';
import { GitHubUIManager } from './ui/github-ui-manager.js';
import { CoordinateStorage } from './data/coordinate-storage.js';
import { RoomSelector } from './data/room-selector.js';
import { PanelManager } from './ui/panel-manager.js';
import { StatusManager } from './utils/status-manager.js';
import { eventBus, EVENTS } from './utils/event-bus.js';
import { MapGenerationCoordinator } from './generation/map-generation-coordinator.js';
import { ExportManager } from './export/export-manager.js';
import { DEFAULT_CONFIG, createConfig } from './config/default-config.js';

class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.mapdbVersion = null;
        this.mapdbLoader = new MapDBLoader();
        this.config = createConfig();
        this.currentGroups = [];
        
        // Ensure tagColors is always a Map
        if (!this.config.tagColors || !(this.config.tagColors instanceof Map)) {
            this.config.tagColors = new Map();
        }
        
        // Initialize services
        this.coordinateStorage = new CoordinateStorage();
        this.github = new GitHubIntegration();
        this.githubUI = null; // Will be initialized after GitHub setup
        this.statusManager = new StatusManager();
        this.roomSelector = null;
        this.panelManager = null;
        this.mapGenerationCoordinator = null;
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
            this.panelManager = new PanelManager(this.config, this.mapdbLoader, this.mapdb);
            
            // Initialize map generation coordinator
            const mapGenerator = new MapGenerator();
            this.mapGenerationCoordinator = new MapGenerationCoordinator(
                this.config,
                this.roomSelector,
                this.panelManager,
                this.coordinateStorage
            );
            this.mapGenerationCoordinator.setMapGenerator(mapGenerator);
            this.mapGenerationCoordinator.setMapDBVersion(this.mapdbVersion);
            
            // Initialize export manager
            this.exportManager = new ExportManager(
                this.config,
                this.roomSelector,
                this.panelManager,
                mapGenerator,
                this.mapdbVersion
            );
            
            // Initialize GitHub UI manager
            this.githubUI = new GitHubUIManager(this, this.github);
            
            // Make managers available globally for UI
            window.app.exportManager = this.exportManager;
            window.app.githubUI = this.githubUI;
            window.app.groupPositioningPanel = this.panelManager.panels.groupPositioning;
            
            // Initialize UI
            this.panelManager.init();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup GitHub UI
            this.githubUI.setupGitHubUI();
            this.githubUI.checkGitHubAuth();
            
            // Show main interface
            this.showMainInterface();
            
        } catch (error) {
            console.error('[INIT FAIL]', error, error.stack);
            StatusManager.error('Failed to initialize application: ' + error.message);
        }
    }

    async loadMapDB() {
        try {
            const result = await this.mapdbLoader.loadMapDB(
                (percent, loaded, total, message) => {
                    StatusManager.progress(percent, message);
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
        // Export/Import full configuration
        const exportConfigBtn = document.getElementById('export-full-config');
        if (exportConfigBtn) {
            exportConfigBtn.addEventListener('click', () => {
                const mapName = document.getElementById('output-name').value || 'elanthia_map';
                const config = this.exportManager.generateConfigForExport(mapName);
                this.exportManager.configExporter.downloadConfig(config, `${mapName}_config.json`);
                StatusManager.update('Configuration exported!');
            });
        }

        const importConfigBtn = document.getElementById('import-full-config');
        if (importConfigBtn) {
            importConfigBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const parsedConfig = this.exportManager.configExporter.parseConfig(event.target.result);
                            this.exportManager.configExporter.applyConfig(parsedConfig, this.panelManager, this.config);
                            
                            // Update output name if available
                            if (parsedConfig.metadata?.name) {
                                document.getElementById('output-name').value = parsedConfig.metadata.name;
                            }
                            
                            StatusManager.update(`Configuration imported from ${file.name}!`);
                        } catch (error) {
                            StatusManager.error('Failed to import configuration: ' + error.message);
                        }
                    };
                    reader.readAsText(file);
                };
                
                input.click();
            });
        }

        // Listen for config changes
        eventBus.on(EVENTS.CONFIG_CHANGED, (data) => {
            console.log('Config changed:', data);
            // Ensure tagColors remains a Map
            if (this.config.tagColors && !(this.config.tagColors instanceof Map)) {
                this.config.tagColors = new Map(this.config.tagColors);
            }
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
            EVENTS.CUSTOM_LABEL_UPDATED,
            EVENTS.CUSTOM_TEXTBOX_ADDED,
            EVENTS.CUSTOM_TEXTBOX_REMOVED,
            EVENTS.CUSTOM_TEXTBOX_UPDATED
        ];

        saveEvents.forEach(event => {
            eventBus.on(event, () => {
                this.mapGenerationCoordinator.saveCurrentCoordinates();
            });
        });
    }

    showMainInterface() {
        this.panelManager.showMainInterface();
        this.statusManager.hideProgress();
        StatusManager.update(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapApp = new MapGenApp();
});