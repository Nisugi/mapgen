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
            theme: 'custom',
            edgeLength: 80,
            roomShape: 'circle',
            roomSize: 15,
            colors: {
                default: '#ffffff',
                background: '#f8f9fa',
                connections: '#666666'
            },
            tagColors: new Map(), // tag -> color mapping
            options: {
                showRoomIds: true,
                showLabels: true,
                showConnections: true,
                debugMode: false
            }
        };
    }

    populateTagDropdown() {
        if (!this.mapdb) return;

        const tagSelect = document.getElementById('tag-select');
        const allTags = this.mapdbLoader.extractTags(this.mapdb);
        
        tagSelect.innerHTML = '<option value="">Select a tag...</option>';
        
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });

        console.log(`Populated ${allTags.length} tags`);
    }

    addTagColor() {
        const tagSelect = document.getElementById('tag-select');
        const selectedTag = tagSelect.value;
        
        if (!selectedTag) {
            alert('Please select a tag first');
            return;
        }

        if (this.config.tagColors.has(selectedTag)) {
            alert('This tag already has a color assigned');
            return;
        }

        // Add to config
        this.config.tagColors.set(selectedTag, '#ff0000'); // Default to red
        
        // Update UI
        this.renderTagColorsList();
        
        // Reset dropdown
        tagSelect.value = '';
    }

    renderTagColorsList() {
        const container = document.getElementById('tag-colors-list');
        
        if (this.config.tagColors.size === 0) {
            container.innerHTML = '<div class="empty-tag-list">No tag colors defined. Select a tag above to add one.</div>';
            return;
        }
        
        let html = '';
        for (const [tag, color] of this.config.tagColors.entries()) {
            html += `
                <div class="tag-color-item" data-tag="${tag}">
                    <span class="tag-name">${tag}</span>
                    <input type="color" value="${color}" data-tag="${tag}">
                    <button class="remove-tag" data-tag="${tag}">Remove</button>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add event listeners
        container.querySelectorAll('input[type="color"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const tag = e.target.dataset.tag;
                this.config.tagColors.set(tag, e.target.value);
            });
        });
        
        container.querySelectorAll('.remove-tag').forEach(button => {
            button.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.config.tagColors.delete(tag);
                this.renderTagColorsList();
            });
        });
    }

    applyThemePreset(e) {
        const themes = {
            maritime: {
                default: '#f0f8ff',
                background: '#e6f3ff',
                connections: '#4682b4',
                tagColors: new Map([
                    ['exit', '#ff6b6b'],
                    ['sea', '#1e90ff'],
                    ['beach', '#f4a460'],
                    ['shop', '#90EE90'],
                    ['bank', '#ffd700']
                ])
            },
            dungeon: {
                default: '#2c2c2c',
                background: '#1a1a1a',
                connections: '#666666',
                tagColors: new Map([
                    ['exit', '#dc2626'],
                    ['shop', '#16a34a'],
                    ['danger', '#ef4444'],
                    ['treasure', '#eab308']
                ])
            },
            forest: {
                default: '#f0f8e8',
                background: '#e8f5e8',
                connections: '#228b22',
                tagColors: new Map([
                    ['exit', '#e74c3c'],
                    ['water', '#4a90e2'],
                    ['shop', '#27ae60'],
                    ['tree', '#2d5016']
                ])
            },
            'high-contrast': {
                default: '#ffffff',
                background: '#000000',
                connections: '#ffffff',
                tagColors: new Map([
                    ['exit', '#ff0000'],
                    ['shop', '#00ff00'],
                    ['water', '#0000ff'],
                    ['danger', '#ff00ff']
                ])
            }
        };

        const theme = themes[e.target.value];
        if (theme) {
            // Update basic colors
            document.getElementById('default-color').value = theme.default;
            document.getElementById('background-color').value = theme.background;
            document.getElementById('connection-color').value = theme.connections;
            
            this.config.colors = { ...theme };
            this.config.tagColors = new Map(theme.tagColors);
            
            this.renderTagColorsList();
        }
    }

    async init() {
        try {
            this.setupEventListeners();
            await this.loadMapDB();
            this.populateLocationDropdown(); // Move this after MapDB loads
            this.showMainInterface();
        } catch (error) {
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    setupEventListeners() {
        // Existing listeners with null checks
        document.querySelectorAll('input[name="mapdb-source"]').forEach(radio => {
            radio.addEventListener('change', this.handleMapDBSourceChange.bind(this));
        });

        document.querySelectorAll('input[name="room-selection"]').forEach(radio => {
            radio.addEventListener('change', this.handleRoomSelectionChange.bind(this));
        });

        // Safe element access with null checks
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', this.handleThemeChange.bind(this));
        }

        const gridSlider = document.getElementById('grid-size');
        if (gridSlider) {
            gridSlider.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('grid-size-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + 'px';
                }
                this.config.options.gridSize = parseInt(e.target.value);
            });
        }

        // New controls (with null checks)
        const edgeLengthSlider = document.getElementById('edge-length');
        if (edgeLengthSlider) {
            edgeLengthSlider.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('edge-length-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + 'px';
                }
                this.config.edgeLength = parseInt(e.target.value);
            });
        }

        const roomSizeSlider = document.getElementById('room-size');
        if (roomSizeSlider) {
            roomSizeSlider.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('room-size-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + 'px';
                }
                this.config.roomSize = parseInt(e.target.value);
            });
        }

        const roomShapeSelect = document.getElementById('room-shape');
        if (roomShapeSelect) {
            roomShapeSelect.addEventListener('change', (e) => {
                this.config.roomShape = e.target.value;
            });
        }

        const addTagButton = document.getElementById('add-tag-color');
        if (addTagButton) {
            addTagButton.addEventListener('click', this.addTagColor.bind(this));
        }

        const themePreset = document.getElementById('theme-preset');
        if (themePreset) {
            themePreset.addEventListener('change', this.applyThemePreset.bind(this));
        }

        // File upload
        const fileInput = document.getElementById('mapdb-file');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        }

        // Generate buttons
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', this.generateMap.bind(this));
        }

        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', this.previewMap.bind(this));
        }
    }

    async debugMapDB() {
        console.log('=== MapDB Debug Info ===');
        console.log('MapDB loaded:', !!this.mapdb);
        if (this.mapdb) {
            console.log('Total rooms:', this.mapdb.length);
            console.log('Sample room:', this.mapdb[0]);
            
            const locations = this.mapdbLoader.extractLocations(this.mapdb);
            console.log('Locations found:', locations.length);
            console.log('First 10 locations:', locations.slice(0, 10));
        }
        
        // Check cache info
        const cacheInfo = await this.mapdbLoader.getCacheInfo();
        console.log('Cache info:', cacheInfo);
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
        if (!this.mapdb) {
            console.error('Cannot populate locations - MapDB not loaded');
            return;
        }

        const select = document.getElementById('location-select');
        const locations = this.mapdbLoader.extractLocations(this.mapdb);
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a location...</option>';
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            select.appendChild(option);
        });

        console.log(`Populated ${locations.length} locations`);
        
        // Set a default selection for testing
        if (locations.includes("Sailor's Grief")) {
            select.value = "Sailor's Grief";
        }
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
        
        console.log('Room selection changed to:', e.target.value); // Debug log
        
        if (e.target.value === 'location') {
            locationGroup.classList.remove('hidden');
            customGroup.classList.add('hidden');
        } else if (e.target.value === 'custom') {
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
                    this.config.colors[key] = theme[key];
                }
            });
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            this.updateStatus('Loading custom MapDB file...');
            this.showProgress();
            
            const text = await file.text();
            this.mapdb = JSON.parse(text);
            this.mapdbVersion = 'custom';
            
            this.populateLocationDropdown();
            this.updateStatus('Custom MapDB loaded successfully!');
            this.hideProgress();
            
        } catch (error) {
            this.showError('Failed to load custom MapDB: ' + error.message);
        }
    }

    getSelectedRooms() {
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        
        if (selectionMethod === 'location') {
            const location = document.getElementById('location-select').value;
            if (!location) {
                throw new Error('Please select a location');
            }
            return this.mapdbLoader.getRoomsByLocation(this.mapdb, location);
        } else {
            const rangeText = document.getElementById('room-ranges').value.trim();
            if (!rangeText) {
                throw new Error('Please enter room ranges');
            }
            const roomIds = this.mapdbLoader.parseRoomRanges(rangeText);
            return this.mapdb.filter(room => roomIds.includes(room.id));
        }
    }

    generateMap() {
        try {
            const rooms = this.getSelectedRooms();
            this.updateStatus(`Generating map for ${rooms.length} rooms...`);
            
            // Create map generator
            const generator = new MapGenerator();
            
            // Get current config
            const config = {
                gridSize: parseInt(document.getElementById('grid-size').value),
                colors: {
                    default: document.getElementById('default-color').value,
                    water: document.getElementById('water-color').value,
                    exit: document.getElementById('exit-color').value,
                    shop: document.getElementById('shop-color').value
                },
                showRoomIds: document.getElementById('show-room-ids').checked,
                showLabels: document.getElementById('show-labels').checked,
                showConnections: document.getElementById('show-connections').checked
            };
            
            // Generate map
            const svg = generator.generateMap(rooms, config);
            
            // Download the SVG file
            this.downloadSVG(svg, document.getElementById('output-name').value);
            
            this.updateStatus(`Map generated! ${rooms.length} rooms processed.`);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    previewMap() {
        try {
            const rooms = this.getSelectedRooms();
            
            // Remove the 50 room limit - show all rooms in preview
            this.updateStatus(`Generating preview for ${rooms.length} rooms...`);
            
            // Create map generator
            const generator = new MapGenerator();
            
            // Get current config
            const config = {
                gridSize: parseInt(document.getElementById('grid-size').value),
                colors: {
                    default: document.getElementById('default-color').value,
                    water: document.getElementById('water-color').value,
                    exit: document.getElementById('exit-color').value,
                    shop: document.getElementById('shop-color').value
                },
                showRoomIds: document.getElementById('show-room-ids').checked,
                showLabels: document.getElementById('show-labels').checked,
                showConnections: document.getElementById('show-connections').checked
            };
            
            // Generate preview with ALL rooms
            const svg = generator.generateMap(rooms, config);
            
            // Show preview in a new window
            this.showPreview(svg);
            
            this.updateStatus(`Preview generated for ${rooms.length} rooms.`);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    downloadSVG(svgContent, filename) {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showPreview(svgContent) {
        const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Map Preview</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #f0f0f0; 
                        font-family: Arial, sans-serif;
                    }
                    .map-container {
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        padding: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        overflow: auto;
                    }
                </style>
            </head>
            <body>
                <h3>Map Preview - Full Scale</h3>
                <p>Scroll to explore the entire map. Use browser zoom (Ctrl +/-) to adjust size.</p>
                <div class="map-container">
                    ${svgContent}
                </div>
            </body>
            </html>
        `);
    }

    showMainInterface() {
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('generate-btn').disabled = false;
        document.getElementById('preview-btn').disabled = false;
        this.hideProgress();
        this.populateLocationDropdown();
        this.populateTagDropdown(); // Add this line
        this.renderTagColorsList(); // Add this line
        this.updateStatus(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
        this.debugMapDB();
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showProgress() {
        document.getElementById('progress-container').classList.remove('hidden');
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