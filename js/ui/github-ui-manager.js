// GitHub UI Manager - handles all GitHub-related UI interactions
import { ModalManager } from './modal-manager.js';
import { StatusManager } from '../utils/status-manager.js';

export class GitHubUIManager {
    constructor(app, github) {
        this.app = app;
        this.github = github;
        this.modalManager = new ModalManager();
    }

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

        const refreshMapsBtn = document.getElementById('refresh-maps');
        if (refreshMapsBtn) {
            refreshMapsBtn.addEventListener('click', this.refreshMapList.bind(this));
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
                StatusManager.error('GitHub authentication failed: ' + error.message);
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
            StatusManager.update('Connecting to GitHub...');
            await this.github.authenticate();
        } catch (error) {
            StatusManager.error('GitHub login failed: ' + error.message);
        }
    }

    handleGitHubLogout() {
        this.github.logout();
        this.updateGitHubStatus();
        StatusManager.update('Logged out of GitHub');
    }

    showSaveDialog() {
        if (!this.github.isAuthenticated()) {
            StatusManager.error('Please connect to GitHub first');
            return;
        }

        const mapName = document.getElementById('output-name').value;
        const modal = this.modalManager.createSaveModal(mapName);
        document.body.appendChild(modal);
    }

    async saveToGitHub(button) {
        const modal = button.closest('.modal');
        const mapName = modal.querySelector('#save-map-name').value.trim();
        const description = modal.querySelector('#save-description').value.trim();
        const saveSVG = modal.querySelector('#save-svg').checked;
        const saveCoords = modal.querySelector('#save-coords').checked;
        const saveConfig = modal.querySelector('#save-config').checked;
        const statusDiv = modal.querySelector('.save-status');
        
        if (!mapName) {
            statusDiv.innerHTML = '<p style="color: red;">Please enter a map name</p>';
            return;
        }

        // Disable buttons during save
        button.disabled = true;
        button.textContent = 'Saving...';
        
        try {
            statusDiv.innerHTML = '<p>Preparing files...</p>';
            
            // Get current map data
            const uiState = this.app.panelManager.getUIState();
            const rooms = this.app.roomSelector.getSelectedRooms();
            
            // Detect location from rooms
            const location = this.github.detectLocationFromRooms(rooms);
            
            let svgContent = null;
            let coordsContent = null;
            let configContent = null;
            
            // Generate SVG if needed
            if (saveSVG) {
                statusDiv.innerHTML = '<p>Generating map...</p>';
                
                // Use the same logic as preview/generate
                const groupsWithNames = this.app.mapGenerationCoordinator.getCurrentGroups().map((group, index) => ({
                    ...group,
                    name: uiState.groupData.names.get(index) || `Group ${index + 1}`
                }));
                
                const mapConfig = this.app.mapGenerationCoordinator.buildMapConfig(uiState, groupsWithNames);
                const result = this.app.mapGenerationCoordinator.mapGenerator.generateMapWithGroups(rooms, mapConfig);
                svgContent = result.svg;
            }
            
            // Generate coordinates if needed
            if (saveCoords) {
                const coordData = this.app.exportManager.coordinateExporter.generateCoordinates(
                    rooms,
                    uiState,
                    this.app.config,
                    mapName
                );
                coordsContent = JSON.stringify(coordData, null, 2);
            }
            
            // Generate config if needed
            if (saveConfig) {
                configContent = this.app.exportManager.generateConfigForExport(mapName, description);
            }
            
            statusDiv.innerHTML = '<p>Saving to GitHub...</p>';
            
            // Save to GitHub
            const results = await this.github.saveMapSet(
                mapName,
                location,
                svgContent,
                coordsContent,
                configContent
            );
            
            // Show results
            let successCount = 0;
            let messages = [];
            
            if (results.svg) successCount++;
            if (results.coords) successCount++;
            if (results.config) successCount++;
            
            if (results.errors && results.errors.length > 0) {
                messages.push(`<p style="color: red;">Errors: ${results.errors.map(e => e.error).join(', ')}</p>`);
            }
            
            if (successCount > 0) {
                messages.push(`<p style="color: green;">✓ Saved ${successCount} file(s) to GitHub!</p>`);
                messages.push(`<p>Location: maps/${location}/</p>`);
            }
            
            statusDiv.innerHTML = messages.join('');
            
            // Update button
            button.textContent = 'Close';
            button.onclick = () => modal.remove();
            
        } catch (error) {
            console.error('Save failed:', error);
            statusDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
            button.disabled = false;
            button.textContent = 'Save to GitHub';
        }
    }

    async showLoadDialog() {
        if (!this.github.isAuthenticated()) {
            StatusManager.error('Please connect to GitHub first');
            return;
        }

        const modal = this.modalManager.createLoadModal();
        document.body.appendChild(modal);
        
        // Load available maps
        this.refreshMapList(modal);
    }

    async refreshMapList(modal = null) {
        const container = modal ? modal.querySelector('.map-gallery') : null;
        
        try {
            StatusManager.update('Loading maps from GitHub...');
            const maps = await this.github.listMaps();
            
            if (maps.length === 0) {
                if (container) {
                    container.innerHTML = '<p class="empty">No maps found in GitHub repository</p>';
                }
                StatusManager.update('No maps found');
                return;
            }
            
            // Group maps by location
            const mapsByLocation = {};
            maps.forEach(map => {
                if (!mapsByLocation[map.location]) {
                    mapsByLocation[map.location] = [];
                }
                mapsByLocation[map.location].push(map);
            });
            
            let html = '';
            
            // Sort locations and create sections
            Object.keys(mapsByLocation).sort().forEach(location => {
                html += `<div class="location-section">`;
                html += `<h4>${location}</h4>`;
                
                mapsByLocation[location].forEach(map => {
                    const hasConfig = map.files.config ? 'has-file' : 'missing-file';
                    const hasSVG = map.files.svg ? 'has-file' : 'missing-file';
                    const hasCoords = map.files.coords ? 'has-file' : 'missing-file';
                    
                    html += `
                        <div class="map-item" data-map='${JSON.stringify(map)}'>
                            <div class="map-header">
                                <h4>${map.name}</h4>
                                <span class="map-location">${location}</span>
                            </div>
                            <div class="map-files">
                                <span class="file-badge ${hasSVG}">SVG</span>
                                <span class="file-badge ${hasCoords}">COORDS</span>
                                <span class="file-badge ${hasConfig}">CONFIG</span>
                            </div>
                            <div class="map-actions">
                                <input type="radio" name="selected-map" value="${map.name}" 
                                       data-location="${location}" id="map-${map.name}">
                                <label for="map-${map.name}">Select</label>
                                ${map.files.svg ? `<button class="btn-small preview-btn" onclick="window.app.githubUI.previewGitHubMap('${location}', '${map.name}')">Preview</button>` : ''}
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
            });
            
            if (container) {
                container.innerHTML = html;
                
                // Enable load button when a map is selected
                container.addEventListener('change', (e) => {
                    if (e.target.name === 'selected-map') {
                        document.getElementById('load-selected-map').disabled = false;
                    }
                });
            }
            
            StatusManager.update(`Found ${maps.length} maps in ${Object.keys(mapsByLocation).length} locations`);
            
        } catch (error) {
            console.error('Failed to list maps:', error);
            if (container) {
                container.innerHTML = '<p class="error">Failed to load maps: ' + error.message + '</p>';
            }
            StatusManager.error('Failed to load map list: ' + error.message);
        }
    }

    async loadFromGitHub(button) {
        const modal = button.closest('.modal');
        const selectedRadio = modal.querySelector('input[name="selected-map"]:checked');
        const statusDiv = modal.querySelector('.load-status');
        
        if (!selectedRadio) {
            statusDiv.innerHTML = '<p style="color: red;">Please select a map to load</p>';
            return;
        }
        
        const mapName = selectedRadio.value;
        const location = selectedRadio.dataset.location;
        
        button.disabled = true;
        button.textContent = 'Loading...';
        
        try {
            statusDiv.innerHTML = '<p>Loading map files...</p>';
            
            const results = await this.github.loadMapSet(mapName, location);
            
            let loadedCount = 0;
            let messages = [];
            
            // Load configuration if available
            if (results.config && results.config.content) {
                try {
                    const configData = JSON.parse(results.config.content);
                    this.app.exportManager.configExporter.applyConfig(configData, this.app.panelManager, this.app.config);
                    
                    // Store ALL UI data as pending for later application
                    if (configData.groupPositioning) {
                        window.app.pendingGroupData = configData.groupPositioning;
                    }
                    if (configData.crossGroupConnections) {
                        window.app.pendingCrossConnections = configData.crossGroupConnections;
                    }
                    if (configData.customLabels) {
                        window.app.pendingCustomLabels = configData.customLabels;
                    }
                    if (configData.customTextBoxes) {
                        window.app.pendingCustomTextBoxes = configData.customTextBoxes;
                    }
                    
                    loadedCount++;
                    messages.push('<p style="color: green;">✓ Configuration loaded</p>');
                    
                    // Update output name
                    if (configData.metadata?.name) {
                        document.getElementById('output-name').value = configData.metadata.name;
                    }
                } catch (error) {
                    messages.push('<p style="color: red;">✗ Failed to parse configuration</p>');
                }
            } else {
                messages.push('<p style="color: orange;">⚠ No configuration file found</p>');
            }
            
            // We don't directly load SVG or coordinates - they're generated from config
            if (results.svg) {
                messages.push('<p style="color: blue;">ℹ SVG file available (use configuration to regenerate)</p>');
            }
            
            if (results.coords) {
                messages.push('<p style="color: blue;">ℹ Coordinates file available</p>');
            }
            
            statusDiv.innerHTML = messages.join('');
            
            if (loadedCount > 0) {
                messages.push('<p style="color: green; font-weight: bold;">Map loaded! Click "Preview" or "Generate Map" to see it.</p>');
                statusDiv.innerHTML = messages.join('');
            }
            
            // Update button
            button.textContent = 'Close';
            button.removeAttribute('onclick');
            button.addEventListener('click', () => modal.remove());
            button.disabled = false;
            
        } catch (error) {
            console.error('Load failed:', error);
            statusDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
            button.disabled = false;
            button.textContent = 'Load Selected Map';
        }
    }

    async previewGitHubMap(location, mapName) {
        try {
            StatusManager.update('Loading map preview...');
            const results = await this.github.loadMapSet(mapName, location);
            
            if (results.svg && results.svg.content) {
                const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
                previewWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${mapName} - Preview</title>
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
                        <h3>${mapName} - ${location}</h3>
                        <div class="map-container">
                            ${results.svg.content}
                        </div>
                    </body>
                    </html>
                `);
            } else {
                StatusManager.error('No SVG file found for this map');
            }
        } catch (error) {
            StatusManager.error('Failed to load preview: ' + error.message);
        }
    }
}

export function updateGitHubStatus() {
    // Calls the currently installed UI manager (created in main app bootstrap)
    if (window.app && window.app.githubUI) {
        window.app.githubUI.updateGitHubStatus();
    }
}