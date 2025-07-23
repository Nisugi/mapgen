class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.mapdbVersion = null;
        this.mapdbLoader = new MapDBLoader();
        this.config = this.getDefaultConfig();
        this.currentGroups = []; // Store detected groups
        this.groupOffsets = new Map(); // Store manual offsets for groups
        this.groupNames = new Map(); // Store custom names for groups
        this.init();
    }

    getDefaultConfig() {
        return {
            theme: 'custom',
            edgeLength: 60,
            roomShape: 'square',
            roomSize: 15,
            strokeWidth: 1,
            connectionWidth: 2,
            colors: {
                default: '#ffffff',
                background: '#f8f9fa',
                connections: '#666666',
                verticalConnections: '#999999'
            },
            tagColors: new Map(), // tag -> color mapping
            options: {
                showRoomIds: true,
                showRoomNames: false,
                showLabels: true,
                showConnections: true
            },
            fonts: {
                labels: {
                    size: 8,
                    color: '#444444',
                    family: 'Arial',
                    bold: false
                },
                rooms: {
                    size: 10,
                    color: '#000000',
                    family: 'Arial',
                    bold: false
                }
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
            this.populateLocationDropdown();
            this.showMainInterface();
        } catch (error) {
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    setupEventListeners() {
        // Room selection listeners
        document.querySelectorAll('input[name="room-selection"]').forEach(radio => {
            radio.addEventListener('change', this.handleRoomSelectionChange.bind(this));
        });

        // Edge length slider
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

        // Room size slider
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

        // Stroke width slider
        const strokeWidthSlider = document.getElementById('stroke-width');
        if (strokeWidthSlider) {
            strokeWidthSlider.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('stroke-width-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + 'px';
                }
                this.config.strokeWidth = parseInt(e.target.value);
            });
        }

        // Connection width slider
        const connectionWidthSlider = document.getElementById('connection-width');
        if (connectionWidthSlider) {
            connectionWidthSlider.addEventListener('input', (e) => {
                const valueSpan = document.getElementById('connection-width-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value + 'px';
                }
                this.config.connectionWidth = parseInt(e.target.value);
            });
        }

        // Room shape select
        const roomShapeSelect = document.getElementById('room-shape');
        if (roomShapeSelect) {
            roomShapeSelect.addEventListener('change', (e) => {
                this.config.roomShape = e.target.value;
            });
        }

        // Color inputs
        const defaultColorInput = document.getElementById('default-color');
        if (defaultColorInput) {
            defaultColorInput.addEventListener('change', (e) => {
                this.config.colors.default = e.target.value;
            });
        }

        const backgroundColorInput = document.getElementById('background-color');
        if (backgroundColorInput) {
            backgroundColorInput.addEventListener('change', (e) => {
                this.config.colors.background = e.target.value;
            });
        }

        const connectionColorInput = document.getElementById('connection-color');
        if (connectionColorInput) {
            connectionColorInput.addEventListener('change', (e) => {
                this.config.colors.connections = e.target.value;
            });
        }

        const verticalConnectionColorInput = document.getElementById('vertical-connection-color');
        if (verticalConnectionColorInput) {
            verticalConnectionColorInput.addEventListener('change', (e) => {
                this.config.colors.verticalConnections = e.target.value;
            });
        }

        // Font controls - Labels
        const labelFontSizeInput = document.getElementById('label-font-size');
        if (labelFontSizeInput) {
            labelFontSizeInput.addEventListener('input', (e) => {
                this.config.fonts.labels.size = parseInt(e.target.value);
                document.getElementById('label-font-size-value').textContent = e.target.value + 'px';
            });
        }

        const labelFontColorInput = document.getElementById('label-font-color');
        if (labelFontColorInput) {
            labelFontColorInput.addEventListener('change', (e) => {
                this.config.fonts.labels.color = e.target.value;
            });
        }

        const labelFontFamilySelect = document.getElementById('label-font-family');
        if (labelFontFamilySelect) {
            labelFontFamilySelect.addEventListener('change', (e) => {
                this.config.fonts.labels.family = e.target.value;
            });
        }

        const labelFontBoldCheckbox = document.getElementById('label-font-bold');
        if (labelFontBoldCheckbox) {
            labelFontBoldCheckbox.addEventListener('change', (e) => {
                this.config.fonts.labels.bold = e.target.checked;
            });
        }

        // Font controls - Rooms
        const roomFontSizeInput = document.getElementById('room-font-size');
        if (roomFontSizeInput) {
            roomFontSizeInput.addEventListener('input', (e) => {
                this.config.fonts.rooms.size = parseInt(e.target.value);
                document.getElementById('room-font-size-value').textContent = e.target.value + 'px';
            });
        }

        const roomFontColorInput = document.getElementById('room-font-color');
        if (roomFontColorInput) {
            roomFontColorInput.addEventListener('change', (e) => {
                this.config.fonts.rooms.color = e.target.value;
            });
        }

        const roomFontFamilySelect = document.getElementById('room-font-family');
        if (roomFontFamilySelect) {
            roomFontFamilySelect.addEventListener('change', (e) => {
                this.config.fonts.rooms.family = e.target.value;
            });
        }

        const roomFontBoldCheckbox = document.getElementById('room-font-bold');
        if (roomFontBoldCheckbox) {
            roomFontBoldCheckbox.addEventListener('change', (e) => {
                this.config.fonts.rooms.bold = e.target.checked;
            });
        }

        // Tag color button
        const addTagButton = document.getElementById('add-tag-color');
        if (addTagButton) {
            addTagButton.addEventListener('click', this.addTagColor.bind(this));
        }

        // Theme preset
        const themePreset = document.getElementById('theme-preset');
        if (themePreset) {
            themePreset.addEventListener('change', this.applyThemePreset.bind(this));
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

    handleRoomSelectionChange(e) {
        const locationGroup = document.getElementById('location-group');
        const customGroup = document.getElementById('custom-group');
        
        console.log('Room selection changed to:', e.target.value);
        
        if (e.target.value === 'location') {
            locationGroup.classList.remove('hidden');
            customGroup.classList.add('hidden');
        } else if (e.target.value === 'custom') {
            locationGroup.classList.add('hidden');
            customGroup.classList.remove('hidden');
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
            
            // Prepare groups with names
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: this.groupNames.get(index) || `Group ${index + 1}`
            }));
            
            // Get current config
            const config = {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth,
                colors: {
                    default: this.config.colors.default,
                    background: this.config.colors.background,
                    connections: this.config.colors.connections,
                    verticalConnections: this.config.colors.verticalConnections
                },
                tagColors: this.config.tagColors,
                showRoomIds: document.getElementById('show-room-ids').checked,
                showRoomNames: document.getElementById('show-room-names').checked,
                showLabels: document.getElementById('show-labels').checked,
                showConnections: document.getElementById('show-connections').checked,
                showGroupLabels: document.getElementById('show-group-labels').checked,
                groupOffsets: this.groupOffsets,
                groups: groupsWithNames,
                fonts: this.config.fonts
            };
            
            // Generate map and get group info
            const result = generator.generateMapWithGroups(rooms, config);
            const svg = result.svg;
            this.currentGroups = result.groups;
            
            // Update group positioning panel
            this.updateGroupPositioningPanel();
            
            // Download the SVG file
            this.downloadSVG(svg, document.getElementById('output-name').value);
            
            this.updateStatus(`Map generated! ${rooms.length} rooms in ${this.currentGroups.length} groups.`);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    previewMap() {
        try {
            const rooms = this.getSelectedRooms();
            
            this.updateStatus(`Generating preview for ${rooms.length} rooms...`);
            
            // Create map generator
            const generator = new MapGenerator();
            
            // Prepare groups with names
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: this.groupNames.get(index) || `Group ${index + 1}`
            }));
            
            // Get current config
            const config = {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth,
                colors: {
                    default: this.config.colors.default,
                    background: this.config.colors.background,
                    connections: this.config.colors.connections,
                    verticalConnections: this.config.colors.verticalConnections
                },
                tagColors: this.config.tagColors,
                showRoomIds: document.getElementById('show-room-ids').checked,
                showRoomNames: document.getElementById('show-room-names').checked,
                showLabels: document.getElementById('show-labels').checked,
                showConnections: document.getElementById('show-connections').checked,
                showGroupLabels: true, // Always show group labels in preview
                groupOffsets: this.groupOffsets,
                groups: groupsWithNames,
                fonts: this.config.fonts
            };
            
            // Generate preview and get group info
            const result = generator.generateMapWithGroups(rooms, config);
            const svg = result.svg;
            this.currentGroups = result.groups;
            
            // Update group positioning panel
            this.updateGroupPositioningPanel();
            
            // Show preview in a new window
            this.showPreview(svg);
            
            this.updateStatus(`Preview generated for ${rooms.length} rooms in ${this.currentGroups.length} groups.`);
            
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
        this.populateTagDropdown();
        this.renderTagColorsList();
        this.updateStatus(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
    }

    updateGroupPositioningPanel() {
        const container = document.getElementById('group-positioning');
        if (!container) return;
        
        if (this.currentGroups.length === 0) {
            container.innerHTML = '<p class="empty-message">Generate or preview a map to see groups</p>';
            return;
        }
        
        let html = '<h4>Detected Groups:</h4>';
        html += '<div class="group-list">';
        
        this.currentGroups.forEach((group, index) => {
            const offset = this.groupOffsets.get(index) || { x: 0, y: 0 };
            const roomCount = group.rooms.length;
            const groupName = this.groupNames.get(index) || `Group ${index + 1}`;
            
            html += `
                <div class="group-item" data-group="${index}">
                    <div class="group-header">
                        <input type="text" class="group-name-input" data-group="${index}" 
                               value="${groupName}" placeholder="Group ${index + 1}">
                        <span class="room-count">${roomCount} rooms</span>
                    </div>
                    <div class="offset-controls">
                        <div class="offset-control">
                            <label>X Offset:</label>
                            <input type="range" class="x-offset" data-group="${index}" 
                                   min="-50" max="50" value="${offset.x}" 
                                   oninput="this.nextElementSibling.textContent = this.value">
                            <span class="offset-value">${offset.x}</span>
                        </div>
                        <div class="offset-control">
                            <label>Y Offset:</label>
                            <input type="range" class="y-offset" data-group="${index}" 
                                   min="-50" max="50" value="${offset.y}"
                                   oninput="this.nextElementSibling.textContent = this.value">
                            <span class="offset-value">${offset.y}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        html += '<button class="btn-small" onclick="window.mapApp.resetGroupOffsets()">Reset All</button>';
        html += '<button class="btn-small" onclick="window.mapApp.applyGroupOffsets()">Apply Changes</button>';
        
        container.innerHTML = html;
        
        // Add event listeners to group name inputs
        container.querySelectorAll('.group-name-input').forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                this.groupNames.set(groupIndex, input.value);
            });
        });
        
        // Add event listeners to sliders
        container.querySelectorAll('.x-offset, .y-offset').forEach(slider => {
            slider.addEventListener('change', () => {
                const groupIndex = parseInt(slider.dataset.group);
                const isX = slider.classList.contains('x-offset');
                const value = parseInt(slider.value);
                
                if (!this.groupOffsets.has(groupIndex)) {
                    this.groupOffsets.set(groupIndex, { x: 0, y: 0 });
                }
                
                if (isX) {
                    this.groupOffsets.get(groupIndex).x = value;
                } else {
                    this.groupOffsets.get(groupIndex).y = value;
                }
            });
        });
    }
    
    resetGroupOffsets() {
        this.groupOffsets.clear();
        this.groupNames.clear();
        this.updateGroupPositioningPanel();
    }
    
    applyGroupOffsets() {
        // Regenerate preview with new offsets
        this.previewMap();
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
    window.mapApp = new MapGenApp();
});