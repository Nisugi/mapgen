class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.mapdbVersion = null;
        this.mapdbLoader = new MapDBLoader();
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
        try {
            this.setupEventListeners();
            await this.loadMapDB();
            this.populateLocationDropdown();
            this.showMainInterface();
        } catch (error) {
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    setupEventListeners() {
        // Radio button changes
        document.querySelectorAll('input[name="mapdb-source"]').forEach(radio => {
            radio.addEventListener('change', this.handleMapDBSourceChange.bind(this));
        });

        document.querySelectorAll('input[name="room-selection"]').forEach(radio => {
            radio.addEventListener('change', this.handleRoomSelectionChange.bind(this));
        });

        // Theme changes
        document.getElementById('theme-select').addEventListener('change', this.handleThemeChange.bind(this));

        // Grid size slider
        const gridSlider = document.getElementById('grid-size');
        gridSlider.addEventListener('input', (e) => {
            document.getElementById('grid-size-value').textContent = e.target.value + 'px';
            this.config.options.gridSize = parseInt(e.target.value);
        });

        // File upload
        document.getElementById('mapdb-file').addEventListener('change', this.handleFileUpload.bind(this));

        // Generate button
        document.getElementById('generate-btn').addEventListener('click', this.generateMap.bind(this));
        document.getElementById('preview-btn').addEventListener('click', this.previewMap.bind(this));
    }

    async loadMapDB() {
        try {
            const result = await this.mapdbLoader.loadMapDB(
                (percent, loaded, total, message) => {
                    this.updateProgress(percent, message);
                }
            );

            this.mapdb = result.data;
            this.mapdbVersion = result.version;

            console.log(`MapDB loaded: ${this.mapdb.length} rooms from version ${this.mapdbVersion}`);
            
        } catch (error) {
            throw new Error('Failed to load MapDB: ' + error.message);
        }
    }

    populateLocationDropdown() {
        const select = document.getElementById('location-select');
        const locations = this.mapdbLoader.extractLocations(this.mapdb);
        
        select.innerHTML = '<option value="">Select a location...</option>';
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            select.appendChild(option);
        });

        console.log(`Populated ${locations.length} locations`);
    }

    handleMapDBSourceChange(e) {
        const fileInput = document.getElementById('mapdb-file');
        if (e.target.value === 'file') {
            fileInput.classList.remove('hidden');
        } else {
            fileInput.classList.add('hidden');
        }
    }

    handleRoomSelectionChange(e) {
        const locationGroup = document.getElementById('location-group');
        const customGroup = document.getElementById('custom-group');
        
        if (e.target.value === 'location') {
            locationGroup.classList.remove('hidden');
            customGroup.classList.add('hidden');
        } else {
            locationGroup.classList.add('hidden');
            customGroup.classList.remove('hidden');
        }
    }

    handleThemeChange(e) {
        const themes = {
            maritime: {
                default: '#ffffff',
                water: '#8cc6ff',
                exit: '#ff6b6b',
                shop: '#90EE90'
            },
            dungeon: {
                default: '#2c2c2c',
                water: '#1e3a8a',
                exit: '#dc2626',
                shop: '#16a34a'
            },
            forest: {
                default: '#f0f8e8',
                water: '#4a90e2',
                exit: '#e74c3c',
                shop: '#27ae60'
            }
        };

        const theme = themes[e.target.value];
        if (theme) {
            Object.keys(theme).forEach(key => {
                const input = document.getElementById(key + '-color');
                if (input) {
                    input.value = theme[key];
                }
            });
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            this.updateStatus('Loading custom MapDB file...');
            const text = await file.text();
            this.mapdb = JSON.parse(text);
            this.mapdbVersion = 'custom';
            
            this.populateLocationDropdown();
            this.updateStatus('Custom MapDB loaded successfully!');
            
        } catch (error) {
            this.showError('Failed to load custom MapDB: ' + error.message);
        }
    }

    generateMap() {
        this.updateStatus('Generating map...');
        // TODO: Implement map generation
        console.log('Generate map clicked');
    }

    previewMap() {
        this.updateStatus('Generating preview...');
        // TODO: Implement map preview
        console.log('Preview map clicked');
    }

    showMainInterface() {
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('generate-btn').disabled = false;
        document.getElementById('preview-btn').disabled = false;
        this.hideProgress();
        this.updateStatus(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    updateProgress(percent, message = null) {
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressContainer.classList.remove('hidden');
        progressFill.style.width = percent + '%';
        progressText.textContent = percent + '%';
        
        if (message) {
            this.updateStatus(message);
        }
    }

    hideProgress() {
        document.getElementById('progress-container').classList.add('hidden');
    }

    showError(message) {
        this.updateStatus('❌ ' + message);
        this.hideProgress();
        console.error(message);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MapGenApp();
});