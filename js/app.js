class MapGenApp {
    constructor() {
        this.mapdb = null;
        this.mapdbVersion = null;
        this.mapdbLoader = new MapDBLoader();
        this.config = this.getDefaultConfig();
        this.currentGroups = []; // Store detected groups
        this.groupOffsets = new Map(); // Store manual offsets for groups
        this.groupNames = new Map(); // Store custom names for groups
        this.groupLabelOffsets = new Map(); // Store label position offsets
        this.crossGroupConnections = []; // Store cross-group connections
        this.customLabels = []; // Store custom labels
        this.coordinateStorage = new CoordinateStorage(); // New coordinate persistence
        this.github = new GitHubIntegration(); // GitHub integration
        this.init();
    }

    getDefaultConfig() {
        return {
            theme: 'custom',
            edgeLength: 80,
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
            },
            backgroundImage: null,
            useBackground: true
        };
    }

    async init() {
        try {
            this.setupEventListeners();
            await this.loadMapDB();
            this.populateLocationDropdown();
            this.setupGitHubUI();
            this.checkGitHubAuth();
            this.showMainInterface();
        } catch (error) {
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    // GitHub Integration Methods

    setupGitHubUI() {
        // Update GitHub status in UI
        this.updateGitHubStatus();
        
        // Add GitHub event listeners
        const githubLoginBtn = document.getElementById('github-login');
        if (githubLoginBtn) {
            githubLoginBtn.addEventListener('click', this.handleGitHubLogin.bind(this));
        }

        const githubLogoutBtn = document.getElementById('github-logout');
        if (githubLogoutBtn) {
            githubLogoutBtn.addEventListener('click', this.handleGitHubLogout.bind(this));
        }

        const saveToGitHubBtn = document.getElementById('save-to-github');
        if (saveToGitHubBtn) {
            saveToGitHubBtn.addEventListener('click', this.showSaveDialog.bind(this));
        }

        const loadFromGitHubBtn = document.getElementById('load-from-github');
        if (loadFromGitHubBtn) {
            loadFromGitHubBtn.addEventListener('click', this.showLoadDialog.bind(this));
        }

        const refreshMapsBtn = document.getElementById('refresh-maps');
        if (refreshMapsBtn) {
            refreshMapsBtn.addEventListener('click', this.refreshMapGallery.bind(this));
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
                this.showError('GitHub authentication failed: ' + error.message);
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
            this.updateStatus('Connecting to GitHub...');
            await this.github.authenticate();
        } catch (error) {
            this.showError('GitHub login failed: ' + error.message);
        }
    }

    handleGitHubLogout() {
        this.github.clearToken();
        this.updateGitHubStatus();
        this.updateStatus('Logged out of GitHub');
    }

    showSaveDialog() {
        if (!this.github.isAuthenticated()) {
            alert('Please connect to GitHub first');
            return;
        }

        if (!this.currentGroups || this.currentGroups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        // Create modal dialog
        const modal = this.createSaveModal();
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
    }

    createSaveModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'save-modal';
        
        // Detect location from current rooms
        let detectedLocation = 'custom';
        try {
            const rooms = this.getSelectedRooms();
            detectedLocation = this.github.detectLocationFromRooms(rooms);
        } catch (error) {
            console.warn('Could not detect location:', error);
        }

        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <h3>💾 Save Map to GitHub</h3>
                <div class="form-group">
                    <label for="save-map-name">Map Name:</label>
                    <input type="text" id="save-map-name" value="${document.getElementById('output-name').value}" placeholder="Enter map name">
                </div>
                <div class="form-group">
                    <label for="save-description">Description (optional):</label>
                    <textarea id="save-description" placeholder="Describe this map..." rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="save-location">Location Folder:</label>
                    <select id="save-location">
                        <option value="${detectedLocation}" selected>${detectedLocation} (detected)</option>
                        <option value="custom">custom</option>
                        <option value="sailors_grief">sailors_grief</option>
                        <option value="hinterwildes">hinterwildes</option>
                        <option value="icemule">icemule</option>
                        <option value="wehnimers">wehnimers</option>
                        <option value="solhaven">solhaven</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Files to Save:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="save-svg" checked> SVG Map File</label>
                        <label><input type="checkbox" id="save-coords" checked> Coordinate Data</label>
                        <label><input type="checkbox" id="save-config" checked> Configuration</label>
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="confirm-save" class="btn-primary">💾 Save to GitHub</button>
                    <button id="cancel-save" class="btn-secondary">Cancel</button>
                </div>
                <div id="save-status" class="save-status hidden"></div>
            </div>
        `;

        // Add event listeners
        modal.querySelector('#confirm-save').addEventListener('click', this.handleConfirmSave.bind(this));
        modal.querySelector('#cancel-save').addEventListener('click', this.closeSaveModal.bind(this));
        modal.querySelector('.modal-overlay').addEventListener('click', this.closeSaveModal.bind(this));

        return modal;
    }

    async handleConfirmSave() {
        const mapName = document.getElementById('save-map-name').value.trim();
        const description = document.getElementById('save-description').value.trim();
        const location = document.getElementById('save-location').value;
        const saveSvg = document.getElementById('save-svg').checked;
        const saveCoords = document.getElementById('save-coords').checked;
        const saveConfig = document.getElementById('save-config').checked;

        if (!mapName) {
            alert('Please enter a map name');
            return;
        }

        if (!saveSvg && !saveCoords && !saveConfig) {
            alert('Please select at least one file type to save');
            return;
        }

        const statusDiv = document.getElementById('save-status');
        statusDiv.classList.remove('hidden');
        statusDiv.textContent = 'Preparing files...';

        try {
            // Generate files
            let svgContent = null;
            let coordsContent = null;
            let configContent = null;

            if (saveSvg) {
                statusDiv.textContent = 'Generating SVG...';
                svgContent = await this.generateSVGForSave();
            }

            if (saveCoords) {
                statusDiv.textContent = 'Generating coordinates...';
                coordsContent = this.generateCoordsForSave();
            }

            if (saveConfig) {
                statusDiv.textContent = 'Generating configuration...';
                configContent = this.generateConfigForSave(mapName, description);
            }

            statusDiv.textContent = 'Saving to GitHub...';

            // Save to GitHub
            const results = await this.github.saveMapSet(
                mapName, 
                location, 
                svgContent, 
                coordsContent, 
                configContent
            );

            statusDiv.textContent = '✅ Saved successfully!';
            statusDiv.style.color = '#27ae60';

            setTimeout(() => {
                this.closeSaveModal();
                this.updateStatus(`Map "${mapName}" saved to GitHub!`);
            }, 1500);

        } catch (error) {
            statusDiv.textContent = '❌ Save failed: ' + error.message;
            statusDiv.style.color = '#e74c3c';
            console.error('Save failed:', error);
        }
    }

    async generateSVGForSave() {
        // Generate SVG using current settings
        const rooms = this.getSelectedRooms();
        const generator = new MapGenerator();
        
        const groupsWithNames = this.currentGroups.map((group, index) => ({
            ...group,
            name: this.groupNames.get(index) || `Group ${index + 1}`
        }));
        
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
            groupLabelOffsets: this.groupLabelOffsets,
            groups: groupsWithNames,
            fonts: this.config.fonts,
            backgroundImage: this.config.backgroundImage,
            useBackground: this.config.useBackground,
            crossGroupConnections: this.crossGroupConnections,
            customLabels: this.customLabels
        };
        
        const result = generator.generateMapWithGroups(rooms, config);
        return result.svg;
    }

    generateCoordsForSave() {
        // Generate coordinate data for external tools
        try {
            const rooms = this.getSelectedRooms();
            const generator = new MapGenerator();
            
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: this.groupNames.get(index) || `Group ${index + 1}`
            }));
            
            const config = {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                groupOffsets: this.groupOffsets,
                groups: groupsWithNames
            };
            
            const result = generator.generateMapWithGroups(rooms, config);
            const finalPositions = generator.applyGroupOffsets(result.groups);
            
            // Calculate bounds and offsets
            const coords = Array.from(finalPositions.values());
            const minX = Math.min(...coords.map(p => p.x));
            const minY = Math.min(...coords.map(p => p.y));
            const padding = 2;
            const offsetX = -minX + padding;
            const offsetY = -minY + padding;
            
            // Generate coordinate data
            const coordData = [];
            rooms.forEach(room => {
                const pos = finalPositions.get(room.id);
                if (pos) {
                    const x = (pos.x + offsetX) * config.edgeLength;
                    const y = (pos.y + offsetY) * config.edgeLength;
                    const half = config.roomSize;
                    
                    // Calculate bounding box based on room shape
                    let left, top, right, bottom;
                    if (config.roomShape === 'circle') {
                        left = x - half;
                        top = y - half;
                        right = x + half;
                        bottom = y + half;
                    } else if (config.roomShape === 'square') {
                        left = x - half;
                        top = y - half;
                        right = x + half;
                        bottom = y + half;
                    } else if (config.roomShape === 'rectangle') {
                        const width = half * 1.5;
                        const height = half;
                        left = x - width;
                        top = y - height;
                        right = x + width;
                        bottom = y + height;
                    }
                    
                    coordData.push({
                        id: room.id,
                        image: document.getElementById('output-name').value + '.png',
                        image_coords: [
                            Math.round(left),
                            Math.round(top),
                            Math.round(right),
                            Math.round(bottom)
                        ]
                    });
                }
            });
            
            return JSON.stringify(coordData, null, 2);
            
        } catch (error) {
            console.error('Error generating coordinates:', error);
            return JSON.stringify([], null, 2);
        }
    }

    generateConfigForSave(mapName, description = '') {
        // Generate complete configuration for map recreation
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        
        let roomSelection = {
            method: selectionMethod
        };
        
        if (selectionMethod === 'location') {
            const locationSelect = document.getElementById('location-select');
            const selectedOptions = Array.from(locationSelect.selectedOptions);
            roomSelection.locations = selectedOptions.map(opt => opt.value);
        } else {
            roomSelection.ranges = document.getElementById('room-ranges').value.trim();
            roomSelection.useUID = document.querySelector('input[name="room-id-type"]:checked').value === 'uid';
        }
        
        // Add exclusions if present
        const excludeText = document.getElementById('exclude-rooms').value.trim();
        if (excludeText) {
            roomSelection.exclusions = excludeText;
            roomSelection.excludeUseUID = document.querySelector('input[name="exclude-id-type"]:checked').value === 'uid';
        }

        const config = {
            metadata: {
                name: mapName,
                description: description,
                author: this.github.user ? this.github.user.login : 'unknown',
                created: new Date().toISOString(),
                mapdbVersion: this.mapdbVersion,
                appVersion: '1.0.0'
            },
            roomSelection: roomSelection,
            appearance: {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth
            },
            colors: {
                default: this.config.colors.default,
                background: this.config.colors.background,
                connections: this.config.colors.connections,
                verticalConnections: this.config.colors.verticalConnections,
                tagColors: Array.from(this.config.tagColors.entries())
            },
            displayOptions: {
                showRoomIds: document.getElementById('show-room-ids').checked,
                showRoomNames: document.getElementById('show-room-names').checked,
                showLabels: document.getElementById('show-labels').checked,
                showConnections: document.getElementById('show-connections').checked,
                showGroupLabels: document.getElementById('show-group-labels').checked
            },
            fonts: {
                labels: { ...this.config.fonts.labels },
                rooms: { ...this.config.fonts.rooms }
            },
            backgroundSettings: {
                useBackground: this.config.useBackground,
                backgroundImage: this.config.backgroundImage
            },
            groupPositioning: {
                offsets: Array.from(this.groupOffsets.entries()),
                names: Array.from(this.groupNames.entries()),
                labelOffsets: Array.from(this.groupLabelOffsets.entries())
            },
            crossGroupConnections: [...this.crossGroupConnections],
            customLabels: [...this.customLabels]
        };

        return JSON.stringify(config, null, 2);
    }

    closeSaveModal() {
        const modal = document.getElementById('save-modal');
        if (modal) {
            modal.remove();
        }
    }

    showLoadDialog() {
        if (!this.github.isAuthenticated()) {
            alert('Please connect to GitHub first');
            return;
        }

        // Create modal dialog
        const modal = this.createLoadModal();
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Load map gallery
        this.loadMapGallery();
    }

    createLoadModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'load-modal';
        
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content large-modal">
                <h3>📂 Load Map from GitHub</h3>
                <div class="form-group">
                    <label for="gallery-location">Filter by Location:</label>
                    <select id="gallery-location">
                        <option value="">All Locations</option>
                        <option value="sailors_grief">Sailor's Grief</option>
                        <option value="hinterwildes">Hinterwildes</option>
                        <option value="icemule">Icemule</option>
                        <option value="wehnimers">Wehnimer's</option>
                        <option value="solhaven">Solhaven</option>
                        <option value="custom">Custom</option>
                    </select>
                    <button id="refresh-gallery" class="btn-small">🔄 Refresh</button>
                </div>
                <div id="map-gallery" class="map-gallery">
                    <div class="loading">Loading maps...</div>
                </div>
                <div class="modal-actions">
                    <button id="load-selected" class="btn-primary" disabled>📥 Load Selected</button>
                    <button id="cancel-load" class="btn-secondary">Cancel</button>
                </div>
                <div id="load-status" class="load-status hidden"></div>
            </div>
        `;

        // Add event listeners
        modal.querySelector('#gallery-location').addEventListener('change', this.filterMapGallery.bind(this));
        modal.querySelector('#refresh-gallery').addEventListener('click', this.loadMapGallery.bind(this));
        modal.querySelector('#load-selected').addEventListener('click', this.handleLoadSelected.bind(this));
        modal.querySelector('#cancel-load').addEventListener('click', this.closeLoadModal.bind(this));
        modal.querySelector('.modal-overlay').addEventListener('click', this.closeLoadModal.bind(this));

        return modal;
    }

    async loadMapGallery() {
        const gallery = document.getElementById('map-gallery');
        const statusDiv = document.getElementById('load-status');
        
        gallery.innerHTML = '<div class="loading">Loading maps...</div>';
        
        try {
            const maps = await this.github.listMaps();
            this.renderMapGallery(maps);
        } catch (error) {
            gallery.innerHTML = `<div class="error">Failed to load maps: ${error.message}</div>`;
            console.error('Failed to load map gallery:', error);
        }
    }

    renderMapGallery(maps) {
        const gallery = document.getElementById('map-gallery');
        
        if (maps.length === 0) {
            gallery.innerHTML = '<div class="empty">No maps found. Create and save some maps to see them here!</div>';
            return;
        }

        let html = '';
        maps.forEach(map => {
            const hasConfig = !!map.files.config;
            const hasSvg = !!map.files.svg;
            const hasCoords = !!map.files.coords;
            
            html += `
                <div class="map-item" data-map-name="${map.name}" data-location="${map.location || 'unknown'}">
                    <div class="map-header">
                        <h4>${map.name}</h4>
                        <span class="map-location">${map.location || 'unknown'}</span>
                    </div>
                    <div class="map-files">
                        <span class="file-badge ${hasSvg ? 'has-file' : 'missing-file'}">SVG</span>
                        <span class="file-badge ${hasCoords ? 'has-file' : 'missing-file'}">Coords</span>
                        <span class="file-badge ${hasConfig ? 'has-file' : 'missing-file'}">Config</span>
                    </div>
                    <div class="map-actions">
                        <input type="radio" name="selected-map" value="${map.name}|${map.location}" 
                               ${hasConfig ? '' : 'disabled'}>
                        <label>Select</label>
                        ${hasSvg ? `<button class="btn-small preview-btn" data-map-name="${map.name}" data-location="${map.location}">👁 Preview</button>` : ''}
                    </div>
                </div>
            `;
        });
        
        gallery.innerHTML = html;
        
        // Add event listeners
        gallery.querySelectorAll('input[name="selected-map"]').forEach(radio => {
            radio.addEventListener('change', this.updateLoadButton.bind(this));
        });
        
        gallery.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', this.previewGitHubMap.bind(this));
        });
    }

    filterMapGallery() {
        const filterLocation = document.getElementById('gallery-location').value;
        const mapItems = document.querySelectorAll('.map-item');
        
        mapItems.forEach(item => {
            const itemLocation = item.dataset.location;
            if (!filterLocation || itemLocation === filterLocation) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    updateLoadButton() {
        const selectedRadio = document.querySelector('input[name="selected-map"]:checked');
        const loadBtn = document.getElementById('load-selected');
        loadBtn.disabled = !selectedRadio;
    }

    async previewGitHubMap(event) {
        const mapName = event.target.dataset.mapName;
        const location = event.target.dataset.location;
        
        try {
            const mapSet = await this.github.loadMapSet(mapName, location);
            
            if (mapSet.svg) {
                this.showPreview(mapSet.svg.content);
            } else {
                alert('No SVG file found for this map');
            }
        } catch (error) {
            alert('Failed to preview map: ' + error.message);
        }
    }

    async handleLoadSelected() {
        const selectedRadio = document.querySelector('input[name="selected-map"]:checked');
        if (!selectedRadio) return;
        
        const [mapName, location] = selectedRadio.value.split('|');
        const statusDiv = document.getElementById('load-status');
        
        statusDiv.classList.remove('hidden');
        statusDiv.textContent = 'Loading map...';
        
        try {
            const mapSet = await this.github.loadMapSet(mapName, location);
            
            if (mapSet.config) {
                statusDiv.textContent = 'Restoring configuration...';
                await this.restoreMapConfig(JSON.parse(mapSet.config.content));
                
                statusDiv.textContent = '✅ Map loaded successfully!';
                statusDiv.style.color = '#27ae60';
                
                setTimeout(() => {
                    this.closeLoadModal();
                    this.updateStatus(`Map "${mapName}" loaded from GitHub!`);
                }, 1500);
            } else {
                throw new Error('No configuration file found for this map');
            }
            
        } catch (error) {
            statusDiv.textContent = '❌ Load failed: ' + error.message;
            statusDiv.style.color = '#e74c3c';
            console.error('Load failed:', error);
        }
    }

    async restoreMapConfig(config) {
        // Restore room selection
        if (config.roomSelection) {
            const roomSel = config.roomSelection;
            
            // Set selection method
            const methodRadio = document.querySelector(`input[name="room-selection"][value="${roomSel.method}"]`);
            if (methodRadio) {
                methodRadio.checked = true;
                this.handleRoomSelectionChange({ target: methodRadio });
            }
            
            // Restore location or range selection
            if (roomSel.method === 'location' && roomSel.locations) {
                const locationSelect = document.getElementById('location-select');
                Array.from(locationSelect.options).forEach(option => {
                    option.selected = roomSel.locations.includes(option.value);
                });
            } else if (roomSel.method === 'custom') {
                if (roomSel.ranges) {
                    document.getElementById('room-ranges').value = roomSel.ranges;
                }
                if (roomSel.useUID !== undefined) {
                    const uidRadio = document.querySelector(`input[name="room-id-type"][value="${roomSel.useUID ? 'uid' : 'id'}"]`);
                    if (uidRadio) uidRadio.checked = true;
                }
            }
            
            // Restore exclusions
            if (roomSel.exclusions) {
                document.getElementById('exclude-rooms').value = roomSel.exclusions;
                if (roomSel.excludeUseUID !== undefined) {
                    const excludeUidRadio = document.querySelector(`input[name="exclude-id-type"][value="${roomSel.excludeUseUID ? 'uid' : 'id'}"]`);
                    if (excludeUidRadio) excludeUidRadio.checked = true;
                }
            }
        }
        
        // Restore appearance
        if (config.appearance) {
            const app = config.appearance;
            if (app.edgeLength) {
                this.config.edgeLength = app.edgeLength;
                document.getElementById('edge-length').value = app.edgeLength;
                document.getElementById('edge-length-value').textContent = app.edgeLength + 'px';
            }
            if (app.roomShape) {
                this.config.roomShape = app.roomShape;
                document.getElementById('room-shape').value = app.roomShape;
            }
            if (app.roomSize) {
                this.config.roomSize = app.roomSize;
                document.getElementById('room-size').value = app.roomSize;
                document.getElementById('room-size-value').textContent = app.roomSize + 'px';
            }
            if (app.strokeWidth) {
                this.config.strokeWidth = app.strokeWidth;
                document.getElementById('stroke-width').value = app.strokeWidth;
                document.getElementById('stroke-width-value').textContent = app.strokeWidth + 'px';
            }
            if (app.connectionWidth) {
                this.config.connectionWidth = app.connectionWidth;
                document.getElementById('connection-width').value = app.connectionWidth;
                document.getElementById('connection-width-value').textContent = app.connectionWidth + 'px';
            }
        }
        
        // Restore colors
        if (config.colors) {
            const colors = config.colors;
            if (colors.default) {
                this.config.colors.default = colors.default;
                document.getElementById('default-color').value = colors.default;
            }
            if (colors.background) {
                this.config.colors.background = colors.background;
                document.getElementById('background-color').value = colors.background;
            }
            if (colors.connections) {
                this.config.colors.connections = colors.connections;
                document.getElementById('connection-color').value = colors.connections;
            }
            if (colors.verticalConnections) {
                this.config.colors.verticalConnections = colors.verticalConnections;
                document.getElementById('vertical-connection-color').value = colors.verticalConnections;
            }
            if (colors.tagColors) {
                this.config.tagColors = new Map(colors.tagColors);
                this.renderTagColorsList();
            }
        }
        
        // Restore display options
        if (config.displayOptions) {
            const opts = config.displayOptions;
            document.getElementById('show-room-ids').checked = opts.showRoomIds !== false;
            document.getElementById('show-room-names').checked = opts.showRoomNames === true;
            document.getElementById('show-labels').checked = opts.showLabels !== false;
            document.getElementById('show-connections').checked = opts.showConnections !== false;
            document.getElementById('show-group-labels').checked = opts.showGroupLabels === true;
        }
        
        // Restore fonts
        if (config.fonts) {
            if (config.fonts.labels) {
                const labels = config.fonts.labels;
                this.config.fonts.labels = { ...this.config.fonts.labels, ...labels };
                if (labels.size) {
                    document.getElementById('label-font-size').value = labels.size;
                    document.getElementById('label-font-size-value').textContent = labels.size + 'px';
                }
                if (labels.color) document.getElementById('label-font-color').value = labels.color;
                if (labels.family) document.getElementById('label-font-family').value = labels.family;
                if (labels.bold !== undefined) document.getElementById('label-font-bold').checked = labels.bold;
            }
            if (config.fonts.rooms) {
                const rooms = config.fonts.rooms;
                this.config.fonts.rooms = { ...this.config.fonts.rooms, ...rooms };
                if (rooms.size) {
                    document.getElementById('room-font-size').value = rooms.size;
                    document.getElementById('room-font-size-value').textContent = rooms.size + 'px';
                }
                if (rooms.color) document.getElementById('room-font-color').value = rooms.color;
                if (rooms.family) document.getElementById('room-font-family').value = rooms.family;
                if (rooms.bold !== undefined) document.getElementById('room-font-bold').checked = rooms.bold;
            }
        }
        
        // Restore background settings
        if (config.backgroundSettings) {
            const bg = config.backgroundSettings;
            if (bg.useBackground !== undefined) {
                this.config.useBackground = bg.useBackground;
                document.getElementById('use-background').checked = bg.useBackground;
            }
            if (bg.backgroundImage) {
                this.config.backgroundImage = bg.backgroundImage;
            }
        }
        
        // Restore group positioning
        if (config.groupPositioning) {
            const gp = config.groupPositioning;
            if (gp.offsets) this.groupOffsets = new Map(gp.offsets);
            if (gp.names) this.groupNames = new Map(gp.names);
            if (gp.labelOffsets) this.groupLabelOffsets = new Map(gp.labelOffsets);
        }
        
        // Restore cross-group connections
        if (config.crossGroupConnections) {
            this.crossGroupConnections = [...config.crossGroupConnections];
        }
        
        // Restore custom labels
        if (config.customLabels) {
            this.customLabels = [...config.customLabels];
        }
        
        // Update output name
        if (config.metadata && config.metadata.name) {
            document.getElementById('output-name').value = config.metadata.name;
        }
        
        // Save to coordinate storage
        this.saveCurrentCoordinates();
        
        // Update UI components
        this.populateTagDropdown();
        this.updateGroupPositioningPanel();
        this.updateCrossGroupConnectionsList();
        this.updateCustomLabelsList();
    }

    closeLoadModal() {
        const modal = document.getElementById('load-modal');
        if (modal) {
            modal.remove();
        }
    }

    async refreshMapGallery() {
        await this.loadMapGallery();
    }

    // Rest of the existing MapGenApp methods remain unchanged...
    // (populateTagDropdown, addTagColor, renderTagColorsList, etc.)

    populateTagDropdown() {
        if (!this.mapdb) return;

        try {
            const rooms = this.getSelectedRooms();
            const tagSelect = document.getElementById('tag-select');
            
            // Extract tags only from selected rooms
            const selectedTags = new Set();
            rooms.forEach(room => {
                if (room.tags && Array.isArray(room.tags)) {
                    room.tags.forEach(tag => selectedTags.add(tag));
                }
            });
            
            const sortedTags = Array.from(selectedTags).sort();
            
            tagSelect.innerHTML = '<option value="">Select a tag...</option>';
            
            sortedTags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagSelect.appendChild(option);
            });

            console.log(`Populated ${sortedTags.length} tags from selected rooms`);
            
        } catch (error) {
            // If we can't get selected rooms yet, show all tags
            const tagSelect = document.getElementById('tag-select');
            const allTags = this.mapdbLoader.extractTags(this.mapdb);
            
            tagSelect.innerHTML = '<option value="">Select a tag...</option>';
            
            allTags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagSelect.appendChild(option);
            });

            console.log(`Populated ${allTags.length} tags (fallback to all)`);
        }
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
                verticalConnections: '#6495ed',
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
                verticalConnections: '#888888',
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
                verticalConnections: '#32cd32',
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
                verticalConnections: '#cccccc',
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
            document.getElementById('vertical-connection-color').value = theme.verticalConnections;
            
            this.config.colors = { ...theme };
            this.config.tagColors = new Map(theme.tagColors);
            
            this.renderTagColorsList();
        }
    }

    setupEventListeners() {
        // Room selection listeners
        document.querySelectorAll('input[name="room-selection"]').forEach(radio => {
            radio.addEventListener('change', this.handleRoomSelectionChange.bind(this));
        });

        // Location selection listener - repopulate tags when location changes
        const locationSelect = document.getElementById('location-select');
        if (locationSelect) {
            locationSelect.addEventListener('change', () => {
                this.populateTagDropdown();
            });
        }

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

        // Background image controls
        const backgroundImageInput = document.getElementById('background-image');
        if (backgroundImageInput) {
            backgroundImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.config.backgroundImage = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const clearBackgroundBtn = document.getElementById('clear-background');
        if (clearBackgroundBtn) {
            clearBackgroundBtn.addEventListener('click', () => {
                this.config.backgroundImage = null;
                if (backgroundImageInput) backgroundImageInput.value = '';
            });
        }

        const useBackgroundCheckbox = document.getElementById('use-background');
        if (useBackgroundCheckbox) {
            useBackgroundCheckbox.addEventListener('change', (e) => {
                this.config.useBackground = e.target.checked;
            });
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

        // Export coordinates button
        const exportCoordsBtn = document.getElementById('export-coords-btn');
        if (exportCoordsBtn) {
            exportCoordsBtn.addEventListener('click', this.exportCoordinates.bind(this));
        }

        // Cross-group connection button
        const addCrossGroupBtn = document.getElementById('add-cross-group');
        if (addCrossGroupBtn) {
            addCrossGroupBtn.addEventListener('click', this.addCrossGroupConnection.bind(this));
        }

        // Custom label button
        const addCustomLabelBtn = document.getElementById('add-custom-label');
        if (addCustomLabelBtn) {
            addCustomLabelBtn.addEventListener('click', this.addCustomLabel.bind(this));
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
        select.innerHTML = '';
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            select.appendChild(option);
        });

        console.log(`Populated ${locations.length} locations`);
        
        // Set a default selection for testing
        if (locations.includes("Sailor's Grief")) {
            const option = select.querySelector(`option[value="Sailor's Grief"]`);
            if (option) option.selected = true;
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
        
        // Repopulate tags for new selection
        this.populateTagDropdown();
    }

    getSelectedRooms() {
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        let selectedRooms = [];
        
        if (selectionMethod === 'location') {
            const locationSelect = document.getElementById('location-select');
            const selectedOptions = Array.from(locationSelect.selectedOptions);
            
            if (selectedOptions.length === 0) {
                throw new Error('Please select at least one location');
            }
            
            // Get rooms from all selected locations
            selectedOptions.forEach(option => {
                const locationRooms = this.mapdbLoader.getRoomsByLocation(this.mapdb, option.value);
                selectedRooms = selectedRooms.concat(locationRooms);
            });
            
            // Remove duplicates (in case rooms exist in multiple locations)
            const roomIds = new Set();
            selectedRooms = selectedRooms.filter(room => {
                if (roomIds.has(room.id)) {
                    return false;
                }
                roomIds.add(room.id);
                return true;
            });
            
        } else {
            const rangeText = document.getElementById('room-ranges').value.trim();
            if (!rangeText) {
                throw new Error('Please enter room ranges');
            }
            
            const useUID = document.querySelector('input[name="room-id-type"]:checked').value === 'uid';
            const roomIds = this.mapdbLoader.parseRoomRanges(rangeText);
            
            if (useUID) {
                // Filter by UID
                selectedRooms = this.mapdb.filter(room => {
                    if (room.uid && Array.isArray(room.uid)) {
                        return roomIds.some(id => room.uid.includes(id));
                    }
                    return false;
                });
            } else {
                // Filter by ID (default)
                selectedRooms = this.mapdb.filter(room => roomIds.includes(room.id));
            }
        }
        
        // Apply exclusions
        const excludeText = document.getElementById('exclude-rooms').value.trim();
        if (excludeText) {
            const useExcludeUID = document.querySelector('input[name="exclude-id-type"]:checked').value === 'uid';
            const excludeIds = this.mapdbLoader.parseRoomRanges(excludeText);
            
            if (useExcludeUID) {
                // Exclude by UID
                selectedRooms = selectedRooms.filter(room => {
                    if (room.uid && Array.isArray(room.uid)) {
                        return !excludeIds.some(id => room.uid.includes(id));
                    }
                    return true; // Keep rooms without UIDs
                });
            } else {
                // Exclude by ID (default)
                selectedRooms = selectedRooms.filter(room => !excludeIds.includes(room.id));
            }
        }
        
        return selectedRooms;
    }

    getCurrentMapIdentifier() {
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        
        if (selectionMethod === 'location') {
            const locationSelect = document.getElementById('location-select');
            const selectedOptions = Array.from(locationSelect.selectedOptions);
            const locations = selectedOptions.map(opt => opt.value).sort().join(',');
            
            // Include exclusions in identifier if present
            const excludeText = document.getElementById('exclude-rooms').value.trim();
            const excludeSuffix = excludeText ? `_exclude_${excludeText.replace(/[^0-9,-]/g, '')}` : '';
            
            return `location_${locations}${excludeSuffix}`;
        } else {
            const rangeText = document.getElementById('room-ranges').value.trim();
            const useUID = document.querySelector('input[name="room-id-type"]:checked').value === 'uid';
            
            // Include exclusions in identifier if present
            const excludeText = document.getElementById('exclude-rooms').value.trim();
            const excludeSuffix = excludeText ? `_exclude_${excludeText.replace(/[^0-9,-]/g, '')}` : '';
            
            return `${useUID ? 'uid' : 'id'}_${rangeText}${excludeSuffix}`;
        }
    }

    loadSavedCoordinates() {
        const mapId = this.getCurrentMapIdentifier();
        const savedCoords = this.coordinateStorage.loadCoordinates(mapId, this.mapdbVersion);
        
        if (savedCoords) {
            console.log('Loading saved coordinates for', mapId);
            this.groupOffsets = new Map(savedCoords.groupOffsets || []);
            this.groupNames = new Map(savedCoords.groupNames || []);
            this.groupLabelOffsets = new Map(savedCoords.groupLabelOffsets || []);
            this.crossGroupConnections = savedCoords.crossGroupConnections || [];
            this.customLabels = savedCoords.customLabels || [];
            return true;
        }
        return false;
    }

    saveCurrentCoordinates() {
        const mapId = this.getCurrentMapIdentifier();
        const coordData = {
            mapId: mapId,
            version: this.mapdbVersion,
            groupOffsets: Array.from(this.groupOffsets.entries()),
            groupNames: Array.from(this.groupNames.entries()),
            groupLabelOffsets: Array.from(this.groupLabelOffsets.entries()),
            crossGroupConnections: this.crossGroupConnections,
            customLabels: this.customLabels,
            created: new Date().toISOString()
        };
        
        this.coordinateStorage.saveCoordinates(mapId, this.mapdbVersion, coordData);
        console.log('Saved coordinates for', mapId);
    }

    generateMap() {
        try {
            const rooms = this.getSelectedRooms();
            this.updateStatus(`Generating map for ${rooms.length} rooms...`);
            
            // Load saved coordinates if available
            this.loadSavedCoordinates();
            
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
                groupLabelOffsets: this.groupLabelOffsets,
                groups: groupsWithNames,
                fonts: this.config.fonts,
                backgroundImage: this.config.backgroundImage,
                useBackground: this.config.useBackground,
                crossGroupConnections: this.crossGroupConnections,
                customLabels: this.customLabels
            };
            
            // Generate map and get group info
            const result = generator.generateMapWithGroups(rooms, config);
            const svg = result.svg;
            this.currentGroups = result.groups;
            
            // Save coordinates
            this.saveCurrentCoordinates();
            
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
            
            // Load saved coordinates if available
            this.loadSavedCoordinates();
            
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
                groupLabelOffsets: this.groupLabelOffsets,
                groups: groupsWithNames,
                fonts: this.config.fonts,
                backgroundImage: this.config.backgroundImage,
                useBackground: this.config.useBackground,
                crossGroupConnections: this.crossGroupConnections,
                customLabels: this.customLabels
            };
            
            // Generate preview and get group info
            const result = generator.generateMapWithGroups(rooms, config);
            const svg = result.svg;
            this.currentGroups = result.groups;
            
            // Save coordinates
            this.saveCurrentCoordinates();
            
            // Update group positioning panel
            this.updateGroupPositioningPanel();
            this.updateCrossGroupConnectionsList();
            this.updateCustomLabelsList();
            
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
        this.updateCrossGroupConnectionsList();
        this.updateCustomLabelsList();
        this.updateStatus(`Ready! MapDB v${this.mapdbVersion} loaded with ${this.mapdb.length} rooms.`);
    }

    // Continue with all remaining methods from the original app.js...
    // (updateGroupPositioningPanel, addCrossGroupConnection, etc.)
    // [The rest of the methods remain exactly the same as in the original app.js]

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
            const labelOffset = this.groupLabelOffsets.get(index) || { x: 0, y: 0 };
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
                        <h5>Group Position</h5>
                        <div class="offset-control">
                            <label>X Offset:</label>
                            <input type="range" class="x-offset" data-group="${index}" 
                                   min="-100" max="100" value="${offset.x}">
                            <input type="number" class="offset-number x-offset-number" data-group="${index}"
                                   min="-100" max="100" value="${offset.x}">
                        </div>
                        <div class="offset-control">
                            <label>Y Offset:</label>
                            <input type="range" class="y-offset" data-group="${index}" 
                                   min="-100" max="100" value="${offset.y}">
                            <input type="number" class="offset-number y-offset-number" data-group="${index}"
                                   min="-100" max="100" value="${offset.y}">
                        </div>
                        <h5>Label Position</h5>
                        <div class="offset-control">
                            <label>Label X:</label>
                            <input type="range" class="label-x-offset" data-group="${index}" 
                                   min="-50" max="50" value="${labelOffset.x}">
                            <input type="number" class="offset-number label-x-offset-number" data-group="${index}"
                                   min="-50" max="50" value="${labelOffset.x}">
                        </div>
                        <div class="offset-control">
                            <label>Label Y:</label>
                            <input type="range" class="label-y-offset" data-group="${index}" 
                                   min="-50" max="50" value="${labelOffset.y}">
                            <input type="number" class="offset-number label-y-offset-number" data-group="${index}"
                                   min="-50" max="50" value="${labelOffset.y}">
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        html += '<button class="btn-small" onclick="window.mapApp.resetGroupOffsets()">Reset All</button>';
        html += '<button class="btn-small" onclick="window.mapApp.applyGroupOffsets()">Apply Changes</button>';
        html += '<button class="btn-small" onclick="window.mapApp.exportCoordinateFile()">Export Coords</button>';
        html += '<button class="btn-small" onclick="window.mapApp.importCoordinateFile()">Import Coords</button>';
        
        container.innerHTML = html;
        
        // Add event listeners to group name inputs
        container.querySelectorAll('.group-name-input').forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                this.groupNames.set(groupIndex, input.value);
                this.saveCurrentCoordinates();
            });
        });
        
        // Add event listeners to group position sliders
        container.querySelectorAll('.x-offset, .y-offset').forEach(slider => {
            slider.addEventListener('input', () => {
                const groupIndex = parseInt(slider.dataset.group);
                const isX = slider.classList.contains('x-offset');
                const value = parseInt(slider.value);
                
                if (!this.groupOffsets.has(groupIndex)) {
                    this.groupOffsets.set(groupIndex, { x: 0, y: 0 });
                }
                
                if (isX) {
                    this.groupOffsets.get(groupIndex).x = value;
                    // Update corresponding number input
                    const numberInput = container.querySelector(`.x-offset-number[data-group="${groupIndex}"]`);
                    if (numberInput) numberInput.value = value;
                } else {
                    this.groupOffsets.get(groupIndex).y = value;
                    // Update corresponding number input
                    const numberInput = container.querySelector(`.y-offset-number[data-group="${groupIndex}"]`);
                    if (numberInput) numberInput.value = value;
                }
                this.saveCurrentCoordinates();
            });
        });
        
        // Add event listeners to label position sliders
        container.querySelectorAll('.label-x-offset, .label-y-offset').forEach(slider => {
            slider.addEventListener('input', () => {
                const groupIndex = parseInt(slider.dataset.group);
                const isX = slider.classList.contains('label-x-offset');
                const value = parseInt(slider.value);
                
                if (!this.groupLabelOffsets.has(groupIndex)) {
                    this.groupLabelOffsets.set(groupIndex, { x: 0, y: 0 });
                }
                
                if (isX) {
                    this.groupLabelOffsets.get(groupIndex).x = value;
                    // Update corresponding number input
                    const numberInput = container.querySelector(`.label-x-offset-number[data-group="${groupIndex}"]`);
                    if (numberInput) numberInput.value = value;
                } else {
                    this.groupLabelOffsets.get(groupIndex).y = value;
                    // Update corresponding number input
                    const numberInput = container.querySelector(`.label-y-offset-number[data-group="${groupIndex}"]`);
                    if (numberInput) numberInput.value = value;
                }
                this.saveCurrentCoordinates();
            });
        });
        
        // Add event listeners to number inputs
        container.querySelectorAll('.x-offset-number, .y-offset-number').forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                const isX = input.classList.contains('x-offset-number');
                const value = parseInt(input.value) || 0;
                
                // Clamp value to range
                const clampedValue = Math.max(-100, Math.min(100, value));
                input.value = clampedValue;
                
                if (!this.groupOffsets.has(groupIndex)) {
                    this.groupOffsets.set(groupIndex, { x: 0, y: 0 });
                }
                
                if (isX) {
                    this.groupOffsets.get(groupIndex).x = clampedValue;
                    // Update corresponding slider
                    const slider = container.querySelector(`.x-offset[data-group="${groupIndex}"]`);
                    if (slider) slider.value = clampedValue;
                } else {
                    this.groupOffsets.get(groupIndex).y = clampedValue;
                    // Update corresponding slider
                    const slider = container.querySelector(`.y-offset[data-group="${groupIndex}"]`);
                    if (slider) slider.value = clampedValue;
                }
                this.saveCurrentCoordinates();
            });
        });
        
        // Add event listeners to label number inputs
        container.querySelectorAll('.label-x-offset-number, .label-y-offset-number').forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                const isX = input.classList.contains('label-x-offset-number');
                const value = parseInt(input.value) || 0;
                
                // Clamp value to range
                const clampedValue = Math.max(-50, Math.min(50, value));
                input.value = clampedValue;
                
                if (!this.groupLabelOffsets.has(groupIndex)) {
                    this.groupLabelOffsets.set(groupIndex, { x: 0, y: 0 });
                }
                
                if (isX) {
                    this.groupLabelOffsets.get(groupIndex).x = clampedValue;
                    // Update corresponding slider
                    const slider = container.querySelector(`.label-x-offset[data-group="${groupIndex}"]`);
                    if (slider) slider.value = clampedValue;
                } else {
                    this.groupLabelOffsets.get(groupIndex).y = clampedValue;
                    // Update corresponding slider
                    const slider = container.querySelector(`.label-y-offset[data-group="${groupIndex}"]`);
                    if (slider) slider.value = clampedValue;
                }
                this.saveCurrentCoordinates();
            });
        });
    }
    
    resetGroupOffsets() {
        this.groupOffsets.clear();
        this.groupNames.clear();
        this.groupLabelOffsets.clear();
        this.saveCurrentCoordinates();
        this.updateGroupPositioningPanel();
    }
    
    applyGroupOffsets() {
        // Regenerate preview with new offsets
        this.previewMap();
    }

    exportCoordinateFile() {
        if (!this.currentGroups || this.currentGroups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        const mapId = this.getCurrentMapIdentifier();
        const coordData = {
            mapName: document.getElementById('output-name').value,
            mapId: mapId,
            version: this.mapdbVersion,
            created: new Date().toISOString(),
            groups: this.currentGroups.map((group, index) => ({
                index: index,
                name: this.groupNames.get(index) || `Group ${index + 1}`,
                offset: this.groupOffsets.get(index) || { x: 0, y: 0 },
                labelOffset: this.groupLabelOffsets.get(index) || { x: 0, y: 0 },
                rooms: group.rooms.map(room => ({
                    id: room.id,
                    position: group.positions.get(room.id)
                }))
            })),
            crossGroupConnections: this.crossGroupConnections,
            customLabels: this.customLabels,
            config: {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                strokeWidth: this.config.strokeWidth,
                connectionWidth: this.config.connectionWidth,
                colors: this.config.colors,
                tagColors: Array.from(this.config.tagColors.entries()),
                fonts: this.config.fonts
            }
        };

        const blob = new Blob([JSON.stringify(coordData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${mapId}_coordinates.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.updateStatus('Coordinate file exported!');
    }

    importCoordinateFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const coordData = JSON.parse(event.target.result);
                    
                    // Validate structure
                    if (!coordData.groups || !Array.isArray(coordData.groups)) {
                        throw new Error('Invalid coordinate file format');
                    }
                    
                    // Apply coordinate data
                    this.groupOffsets.clear();
                    this.groupNames.clear();
                    this.groupLabelOffsets.clear();
                    
                    coordData.groups.forEach(group => {
                        this.groupOffsets.set(group.index, group.offset || { x: 0, y: 0 });
                        this.groupNames.set(group.index, group.name || `Group ${group.index + 1}`);
                        this.groupLabelOffsets.set(group.index, group.labelOffset || { x: 0, y: 0 });
                    });
                    
                    if (coordData.crossGroupConnections) {
                        this.crossGroupConnections = coordData.crossGroupConnections;
                    }
                    
                    if (coordData.customLabels) {
                        this.customLabels = coordData.customLabels;
                    }
                    
                    // Apply config if available
                    if (coordData.config) {
                        const config = coordData.config;
                        if (config.edgeLength) {
                            this.config.edgeLength = config.edgeLength;
                            document.getElementById('edge-length').value = config.edgeLength;
                            document.getElementById('edge-length-value').textContent = config.edgeLength + 'px';
                        }
                        if (config.roomShape) {
                            this.config.roomShape = config.roomShape;
                            document.getElementById('room-shape').value = config.roomShape;
                        }
                        if (config.roomSize) {
                            this.config.roomSize = config.roomSize;
                            document.getElementById('room-size').value = config.roomSize;
                            document.getElementById('room-size-value').textContent = config.roomSize + 'px';
                        }
                        if (config.colors) {
                            this.config.colors = { ...this.config.colors, ...config.colors };
                            document.getElementById('default-color').value = config.colors.default || this.config.colors.default;
                            document.getElementById('background-color').value = config.colors.background || this.config.colors.background;
                            document.getElementById('connection-color').value = config.colors.connections || this.config.colors.connections;
                            document.getElementById('vertical-connection-color').value = config.colors.verticalConnections || this.config.colors.verticalConnections;
                        }
                        if (config.tagColors) {
                            this.config.tagColors = new Map(config.tagColors);
                            this.renderTagColorsList();
                        }
                    }
                    
                    // Save to storage
                    this.saveCurrentCoordinates();
                    
                    // Update UI
                    this.updateGroupPositioningPanel();
                    this.updateCrossGroupConnectionsList();
                    this.updateCustomLabelsList();
                    
                    this.updateStatus(`Coordinates imported from ${file.name}!`);
                    
                } catch (error) {
                    alert('Error importing coordinate file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    addCrossGroupConnection() {
        const fromId = parseInt(document.getElementById('cross-from-room').value);
        const toId = parseInt(document.getElementById('cross-to-room').value);
        
        if (!fromId || !toId) {
            alert('Please enter both room IDs');
            return;
        }
        
        if (fromId === toId) {
            alert('Cannot connect a room to itself');
            return;
        }
        
        // Check if connection already exists
        if (this.crossGroupConnections.some(conn => 
            (conn.fromId === fromId && conn.toId === toId) ||
            (conn.fromId === toId && conn.toId === fromId)
        )) {
            alert('This connection already exists');
            return;
        }
        
        // Add connection with default settings
        this.crossGroupConnections.push({
            fromId: fromId,
            toId: toId,
            style: 'dashed',
            dashSpacing: '5,5',
            color: this.config.colors.connections
        });
        
        // Clear inputs
        document.getElementById('cross-from-room').value = '';
        document.getElementById('cross-to-room').value = '';
        
        // Save and update
        this.saveCurrentCoordinates();
        this.updateCrossGroupConnectionsList();
    }
    
    updateCrossGroupConnectionsList() {
        const container = document.getElementById('cross-group-list');
        
        if (this.crossGroupConnections.length === 0) {
            container.innerHTML = '<p class="empty-message">No cross-group connections defined</p>';
            return;
        }
        
        let html = '<div class="connection-list">';
        
        this.crossGroupConnections.forEach((conn, index) => {
            html += `
                <div class="connection-item" data-index="${index}">
                    <div class="connection-header">
                        <span>Room ${conn.fromId} → Room ${conn.toId}</span>
                        <button class="btn-small remove-connection" data-index="${index}">Remove</button>
                    </div>
                    <div class="connection-controls">
                        <div class="control-group">
                            <label>Style:</label>
                            <select class="conn-style" data-index="${index}">
                                <option value="dashed" ${conn.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                                <option value="dotted" ${conn.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Spacing:</label>
                            <input type="text" class="conn-spacing" data-index="${index}" 
                                   value="${conn.dashSpacing}" placeholder="5,5">
                        </div>
                        <div class="control-group">
                            <label>Color:</label>
                            <input type="color" class="conn-color" data-index="${index}" 
                                   value="${conn.color}">
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add event listeners
        container.querySelectorAll('.remove-connection').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.crossGroupConnections.splice(index, 1);
                this.saveCurrentCoordinates();
                this.updateCrossGroupConnectionsList();
            });
        });
        
        container.querySelectorAll('.conn-style').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.crossGroupConnections[index].style = select.value;
                // Update dash spacing based on style
                if (select.value === 'dotted') {
                    this.crossGroupConnections[index].dashSpacing = '2,3';
                } else {
                    this.crossGroupConnections[index].dashSpacing = '5,5';
                }
                this.saveCurrentCoordinates();
                this.updateCrossGroupConnectionsList();
            });
        });
        
        container.querySelectorAll('.conn-spacing').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.crossGroupConnections[index].dashSpacing = input.value;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.conn-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.crossGroupConnections[index].color = input.value;
                this.saveCurrentCoordinates();
            });
        });
    }

    addCustomLabel() {
        const text = document.getElementById('custom-label-text').value.trim();
        
        if (!text) {
            alert('Please enter label text');
            return;
        }
        
        // Add label with default settings
        this.customLabels.push({
            text: text,
            x: 50, // Default position
            y: 50,
            fontSize: 12,
            fontColor: '#000000',
            fontFamily: 'Arial',
            bold: false,
            background: true,
            backgroundColor: this.config.colors.background,
            borderColor: this.config.colors.connections,
            borderWidth: 1
        });
        
        // Clear input
        document.getElementById('custom-label-text').value = '';
        
        // Save and update
        this.saveCurrentCoordinates();
        this.updateCustomLabelsList();
    }
    
    updateCustomLabelsList() {
        const container = document.getElementById('custom-labels-list');
        
        if (this.customLabels.length === 0) {
            container.innerHTML = '<p class="empty-message">No custom labels defined</p>';
            return;
        }
        
        let html = '<div class="label-list">';
        
        this.customLabels.forEach((label, index) => {
            html += `
                <div class="label-item" data-index="${index}">
                    <div class="label-header">
                        <input type="text" class="label-text-input" data-index="${index}" 
                               value="${label.text}">
                        <button class="btn-small remove-label" data-index="${index}">Remove</button>
                    </div>
                    <div class="label-controls">
                        <div class="control-row">
                            <div class="control-group">
                                <label>X:</label>
                                <input type="number" class="label-x" data-index="${index}" 
                                       value="${label.x}" min="-1000" max="1000">
                            </div>
                            <div class="control-group">
                                <label>Y:</label>
                                <input type="number" class="label-y" data-index="${index}" 
                                       value="${label.y}" min="-1000" max="1000">
                            </div>
                            <div class="control-group">
                                <label>Size:</label>
                                <input type="number" class="label-size" data-index="${index}" 
                                       value="${label.fontSize}" min="8" max="48">
                            </div>
                        </div>
                        <div class="control-row">
                            <div class="control-group">
                                <label>Font:</label>
                                <select class="label-font" data-index="${index}">
                                    <option value="Arial" ${label.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                                    <option value="Times New Roman" ${label.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                                    <option value="Courier New" ${label.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                                    <option value="Georgia" ${label.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                                    <option value="Verdana" ${label.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color:</label>
                                <input type="color" class="label-color" data-index="${index}" 
                                       value="${label.fontColor}">
                            </div>
                            <div class="control-group">
                                <label><input type="checkbox" class="label-bold" data-index="${index}" 
                                        ${label.bold ? 'checked' : ''}> Bold</label>
                            </div>
                        </div>
                        <div class="control-row">
                            <div class="control-group">
                                <label><input type="checkbox" class="label-background" data-index="${index}" 
                                        ${label.background ? 'checked' : ''}> Background</label>
                            </div>
                            <div class="control-group ${!label.background ? 'disabled' : ''}">
                                <label>BG Color:</label>
                                <input type="color" class="label-bg-color" data-index="${index}" 
                                       value="${label.backgroundColor}" ${!label.background ? 'disabled' : ''}>
                            </div>
                            <div class="control-group ${!label.background ? 'disabled' : ''}">
                                <label>Border:</label>
                                <input type="color" class="label-border-color" data-index="${index}" 
                                       value="${label.borderColor}" ${!label.background ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add event listeners
        container.querySelectorAll('.label-text-input').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.customLabels[index].text = input.value;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.remove-label').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.customLabels.splice(index, 1);
                this.saveCurrentCoordinates();
                this.updateCustomLabelsList();
            });
        });
        
        // Position controls
        container.querySelectorAll('.label-x, .label-y').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                const value = parseInt(input.value) || 0;
                
                if (input.classList.contains('label-x')) {
                    this.customLabels[index].x = value;
                } else {
                    this.customLabels[index].y = value;
                }
                this.saveCurrentCoordinates();
            });
        });
        
        // Font controls
        container.querySelectorAll('.label-size').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.customLabels[index].fontSize = parseInt(input.value) || 12;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.label-font').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.customLabels[index].fontFamily = select.value;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.label-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.customLabels[index].fontColor = input.value;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.label-bold').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.customLabels[index].bold = checkbox.checked;
                this.saveCurrentCoordinates();
            });
        });
        
        // Background controls
        container.querySelectorAll('.label-background').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.customLabels[index].background = checkbox.checked;
                this.saveCurrentCoordinates();
                this.updateCustomLabelsList(); // Re-render to enable/disable controls
            });
        });
        
        container.querySelectorAll('.label-bg-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.customLabels[index].backgroundColor = input.value;
                this.saveCurrentCoordinates();
            });
        });
        
        container.querySelectorAll('.label-border-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.customLabels[index].borderColor = input.value;
                this.saveCurrentCoordinates();
            });
        });
    }

    exportCoordinates() {
        if (!this.currentGroups || this.currentGroups.length === 0) {
            alert('Please generate or preview a map first');
            return;
        }

        try {
            const rooms = this.getSelectedRooms();
            const generator = new MapGenerator();
            
            // Get the same config as generate/preview
            const groupsWithNames = this.currentGroups.map((group, index) => ({
                ...group,
                name: this.groupNames.get(index) || `Group ${index + 1}`
            }));
            
            const config = {
                edgeLength: this.config.edgeLength,
                roomShape: this.config.roomShape,
                roomSize: this.config.roomSize,
                groupOffsets: this.groupOffsets,
                groups: groupsWithNames
            };
            
            // Generate positions
            const result = generator.generateMapWithGroups(rooms, config);
            const positions = generator.calculateRoomPositionsWithGroups(rooms, new Map(rooms.map(r => [r.id, r]))).positions;
            
            // Calculate actual positions with offsets
            const finalPositions = generator.applyGroupOffsets(result.groups);
            
            // Get bounds for offset calculation
            const coords = Array.from(finalPositions.values());
            const minX = Math.min(...coords.map(p => p.x));
            const minY = Math.min(...coords.map(p => p.y));
            const padding = 2;
            const offsetX = -minX + padding;
            const offsetY = -minY + padding;
            
            // Generate coordinate data
            let coordData = [];
            rooms.forEach(room => {
                const pos = finalPositions.get(room.id);
                if (pos) {
                    const x = (pos.x + offsetX) * config.edgeLength;
                    const y = (pos.y + offsetY) * config.edgeLength;
                    const half = config.roomSize;
                    
                    // Calculate bounding box based on room shape
                    let left, top, right, bottom;
                    if (config.roomShape === 'circle') {
                        left = x - half;
                        top = y - half;
                        right = x + half;
                        bottom = y + half;
                    } else if (config.roomShape === 'square') {
                        left = x - half;
                        top = y - half;
                        right = x + half;
                        bottom = y + half;
                    } else if (config.roomShape === 'rectangle') {
                        const width = half * 1.5;
                        const height = half;
                        left = x - width;
                        top = y - height;
                        right = x + width;
                        bottom = y + height;
                    }
                    
                    coordData.push({
                        id: room.id,
                        image: document.getElementById('output-name').value + '.png',
                        image_coords: [
                            Math.round(left),
                            Math.round(top),
                            Math.round(right),
                            Math.round(bottom)
                        ]
                    });
                }
            });
            
            // Create export window
            this.showCoordinatesExport(coordData);
            
        } catch (error) {
            alert('Error exporting coordinates: ' + error.message);
        }
    }

    showCoordinatesExport(coordData) {
        const exportWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        
        // Format the data for mapdb
        let mapdbFormat = coordData.map(room => {
            return `  "${room.id}": {\n` +
                   `    "image": "${room.image}",\n` +
                   `    "image_coords": [${room.image_coords.join(', ')}]\n` +
                   `  }`;
        }).join(',\n');
        
        exportWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Room Coordinates Export</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    h2 { color: #333; }
                    .export-container {
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        padding: 20px;
                        margin-bottom: 20px;
                    }
                    textarea {
                        width: 100%;
                        height: 400px;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        border: 1px solid #ccc;
                        padding: 10px;
                    }
                    button {
                        background: #5a67d8;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                    button:hover {
                        background: #4c51bf;
                    }
                    .info {
                        background: #e6f3ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <h2>Room Coordinates Export</h2>
                <div class="info">
                    <strong>Image name:</strong> ${document.getElementById('output-name').value}.png<br>
                    <strong>Total rooms:</strong> ${coordData.length}<br>
                    <strong>Format:</strong> MapDB image_coords format (left, top, right, bottom)
                </div>
                <div class="export-container">
                    <h3>MapDB Format (for room definitions):</h3>
                    <textarea id="mapdb-format" readonly>{
${mapdbFormat}
}</textarea>
                    <button onclick="document.getElementById('mapdb-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy MapDB Format</button>
                </div>
                <div class="export-container">
                    <h3>JSON Format (for reference):</h3>
                    <textarea id="json-format" readonly>${JSON.stringify(coordData, null, 2)}</textarea>
                    <button onclick="document.getElementById('json-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy JSON Format</button>
                </div>
            </body>
            </html>
        `);
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

// Coordinate Storage Class for persistence
class CoordinateStorage {
    constructor() {
        this.storageKey = 'elanthia_map_coordinates';
        this.maxStorageAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    saveCoordinates(mapId, version, coordData) {
        try {
            const storage = this.getStorage();
            storage[mapId] = {
                version: version,
                data: coordData,
                savedAt: Date.now()
            };
            
            // Clean old entries
            this.cleanOldEntries(storage);
            
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
        } catch (error) {
            console.warn('Failed to save coordinates to localStorage:', error);
        }
    }

    loadCoordinates(mapId, version) {
        try {
            const storage = this.getStorage();
            const entry = storage[mapId];
            
            if (!entry) return null;
            
            // Check if version matches and entry is not too old
            const age = Date.now() - entry.savedAt;
            if (entry.version === version && age < this.maxStorageAge) {
                return entry.data;
            }
            
            // Remove outdated entry
            delete storage[mapId];
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
            return null;
            
        } catch (error) {
            console.warn('Failed to load coordinates from localStorage:', error);
            return null;
        }
    }

    getStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to parse stored coordinates:', error);
            return {};
        }
    }

    cleanOldEntries(storage) {
        const now = Date.now();
        const toDelete = [];
        
        for (const [mapId, entry] of Object.entries(storage)) {
            const age = now - entry.savedAt;
            if (age > this.maxStorageAge) {
                toDelete.push(mapId);
            }
        }
        
        toDelete.forEach(mapId => delete storage[mapId]);
    }

    listSavedMaps() {
        const storage = this.getStorage();
        return Object.keys(storage).map(mapId => ({
            mapId,
            version: storage[mapId].version,
            savedAt: new Date(storage[mapId].savedAt).toISOString()
        }));
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear coordinate storage:', error);
        }
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapApp = new MapGenApp();
});