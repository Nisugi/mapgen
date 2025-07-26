class GitHubIntegration {
    constructor() {
        this.apiBase = 'https://api.github.com';
        this.repoName = 'mapgen';
        this.token = this.getStoredToken();
        this.user = null;
        this.repoOwner = this.detectRepoOwner();
        this.branch = 'main'; // or 'gh-pages' depending on setup
        
        // OAuth app details (you'll need to register this)
        this.clientId = 'Ov23lir2CaQo0Q58weV0'; // Replace with actual client ID
        this.redirectUri = this.getRedirectUri();
        
        console.log('GitHub Integration initialized for repo:', `${this.repoOwner}/${this.repoName}`);
    }

    detectRepoOwner() {
        // Try to detect if we're running on a fork vs the main repo
        const hostname = window.location.hostname;
        
        if (hostname.includes('github.io')) {
            // Extract username from GitHub Pages URL
            const parts = hostname.split('.');
            if (parts.length >= 3 && parts[1] === 'github') {
                return parts[0]; // username.github.io
            }
        }
        
        // Fallback - you might want to make this configurable
        return 'elanthia-online'; // or whatever the main repo owner is
    }

    getRedirectUri() {
        const baseUrl = window.location.origin + window.location.pathname;
        return baseUrl.replace(/\/$/, '') + '/auth/callback';
    }

    getStoredToken() {
        try {
            return localStorage.getItem('github_token');
        } catch (error) {
            console.warn('Failed to retrieve stored GitHub token:', error);
            return null;
        }
    }

    storeToken(token) {
        try {
            localStorage.setItem('github_token', token);
            this.token = token;
        } catch (error) {
            console.warn('Failed to store GitHub token:', error);
        }
    }

    clearToken() {
        try {
            localStorage.removeItem('github_token');
            this.token = null;
            this.user = null;
        } catch (error) {
            console.warn('Failed to clear GitHub token:', error);
        }
    }

    async authenticate() {
        if (this.token) {
            // Verify existing token
            try {
                await this.getCurrentUser();
                return true;
            } catch (error) {
                console.log('Stored token invalid, clearing...');
                this.clearToken();
            }
        }

        // Start OAuth flow
        const state = this.generateState();
        localStorage.setItem('github_auth_state', state);
        
        const authUrl = `https://github.com/login/oauth/authorize?` +
            `client_id=${this.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `scope=public_repo&` +
            `state=${state}`;
        
        window.location.href = authUrl;
        return false; // Will redirect
    }

    generateState() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const storedState = localStorage.getItem('github_auth_state');

        if (!code || !state || state !== storedState) {
            throw new Error('Invalid authentication callback');
        }

        // Exchange code for token
        // Note: This requires a backend service or GitHub App
        // For now, we'll show instructions to the user
        throw new Error('OAuth exchange requires backend service. See implementation notes.');
    }

    async getCurrentUser() {
        if (!this.token) {
            throw new Error('No authentication token');
        }

        const response = await this.apiCall('GET', '/user');
        this.user = response;
        return response;
    }

    async apiCall(method, endpoint, data = null) {
        if (!this.token) {
            throw new Error('Authentication required');
        }

        const url = `${this.apiBase}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Elanthia-Map-Generator'
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
        }

        return await response.json();
    }

    async checkRepoAccess() {
        try {
            const repo = await this.apiCall('GET', `/repos/${this.repoOwner}/${this.repoName}`);
            return {
                exists: true,
                canWrite: repo.permissions?.push || repo.permissions?.admin || false,
                isFork: repo.fork || false,
                defaultBranch: repo.default_branch || 'main'
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return { exists: false, canWrite: false };
            }
            throw error;
        }
    }

    async saveFile(path, content, message = 'Save map file') {
        const repoAccess = await this.checkRepoAccess();
        
        if (!repoAccess.exists) {
            throw new Error(`Repository ${this.repoOwner}/${this.repoName} not found`);
        }
        
        if (!repoAccess.canWrite) {
            throw new Error('No write access to repository. Fork the repository to save maps.');
        }

        // Check if file exists to get SHA
        let sha = null;
        try {
            const existingFile = await this.apiCall('GET', `/repos/${this.repoOwner}/${this.repoName}/contents/${path}`);
            sha = existingFile.sha;
        } catch (error) {
            // File doesn't exist, that's okay
        }

        const data = {
            message,
            content: btoa(unescape(encodeURIComponent(content))), // Base64 encode UTF-8
            branch: this.branch
        };

        if (sha) {
            data.sha = sha; // Required for updates
        }

        const response = await this.apiCall('PUT', `/repos/${this.repoOwner}/${this.repoName}/contents/${path}`, data);
        return response;
    }

    async loadFile(path) {
        try {
            const response = await this.apiCall('GET', `/repos/${this.repoOwner}/${this.repoName}/contents/${path}`);
            
            if (response.type !== 'file') {
                throw new Error('Path is not a file');
            }

            // Decode base64 content
            const content = decodeURIComponent(escape(atob(response.content)));
            return {
                content,
                sha: response.sha,
                path: response.path
            };
        } catch (error) {
            if (error.message.includes('404')) {
                throw new Error(`File not found: ${path}`);
            }
            throw error;
        }
    }

    async listMaps(folder = 'maps') {
        try {
            const response = await this.apiCall('GET', `/repos/${this.repoOwner}/${this.repoName}/contents/${folder}`);
            
            if (!Array.isArray(response)) {
                return [];
            }

            const maps = [];
            for (const item of response) {
                if (item.type === 'dir') {
                    // This is a location folder, look for map files inside
                    try {
                        const locationMaps = await this.listLocationMaps(`${folder}/${item.name}`);
                        maps.push(...locationMaps.map(map => ({
                            ...map,
                            location: item.name
                        })));
                    } catch (error) {
                        console.warn(`Failed to list maps in ${item.name}:`, error);
                    }
                }
            }

            return maps;
        } catch (error) {
            if (error.message.includes('404')) {
                return []; // Maps folder doesn't exist yet
            }
            throw error;
        }
    }

    async listLocationMaps(folderPath) {
        const response = await this.apiCall('GET', `/repos/${this.repoOwner}/${this.repoName}/contents/${folderPath}`);
        
        if (!Array.isArray(response)) {
            return [];
        }

        // Group files by map name (remove extensions)
        const mapGroups = new Map();
        
        response.forEach(file => {
            if (file.type === 'file') {
                const fileName = file.name;
                let mapName = fileName;
                let fileType = 'unknown';
                
                if (fileName.endsWith('.svg')) {
                    mapName = fileName.slice(0, -4);
                    fileType = 'svg';
                } else if (fileName.endsWith('_coords.json')) {
                    mapName = fileName.slice(0, -12);
                    fileType = 'coords';
                } else if (fileName.endsWith('_config.json')) {
                    mapName = fileName.slice(0, -12);
                    fileType = 'config';
                }
                
                if (!mapGroups.has(mapName)) {
                    mapGroups.set(mapName, {
                        name: mapName,
                        path: folderPath,
                        files: {}
                    });
                }
                
                mapGroups.get(mapName).files[fileType] = {
                    name: fileName,
                    path: file.path,
                    sha: file.sha,
                    size: file.size
                };
            }
        });

        return Array.from(mapGroups.values()).filter(map => 
            map.files.svg || map.files.config // Must have at least SVG or config
        );
    }

    async saveMapSet(mapName, location, svgContent, coordsContent, configContent) {
        const folderPath = `maps/${location}`;
        const results = {};
        
        // Save all three files
        const savePromises = [];
        
        if (svgContent) {
            savePromises.push(
                this.saveFile(`${folderPath}/${mapName}.svg`, svgContent, `Save ${mapName} map SVG`)
                    .then(result => { results.svg = result; })
            );
        }
        
        if (coordsContent) {
            savePromises.push(
                this.saveFile(`${folderPath}/${mapName}_coords.json`, coordsContent, `Save ${mapName} coordinates`)
                    .then(result => { results.coords = result; })
            );
        }
        
        if (configContent) {
            savePromises.push(
                this.saveFile(`${folderPath}/${mapName}_config.json`, configContent, `Save ${mapName} configuration`)
                    .then(result => { results.config = result; })
            );
        }

        await Promise.all(savePromises);
        return results;
    }

    async loadMapSet(mapName, location) {
        const folderPath = `maps/${location}`;
        const results = {};
        
        // Try to load all three files
        const loadPromises = [
            this.loadFile(`${folderPath}/${mapName}.svg`)
                .then(result => { results.svg = result; })
                .catch(error => { console.warn('SVG not found:', error.message); }),
            
            this.loadFile(`${folderPath}/${mapName}_coords.json`)
                .then(result => { results.coords = result; })
                .catch(error => { console.warn('Coords not found:', error.message); }),
            
            this.loadFile(`${folderPath}/${mapName}_config.json`)
                .then(result => { results.config = result; })
                .catch(error => { console.warn('Config not found:', error.message); })
        ];

        await Promise.all(loadPromises);
        return results;
    }

    // Utility method to determine location from room selection
    detectLocationFromRooms(rooms) {
        if (!rooms || rooms.length === 0) return 'custom';
        
        // Find most common location
        const locationCounts = {};
        rooms.forEach(room => {
            const location = room.location || 'unknown';
            locationCounts[location] = (locationCounts[location] || 0) + 1;
        });
        
        let maxCount = 0;
        let primaryLocation = 'custom';
        
        for (const [location, count] of Object.entries(locationCounts)) {
            if (count > maxCount) {
                maxCount = count;
                primaryLocation = location;
            }
        }
        
        return primaryLocation.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    isAuthenticated() {
        return !!this.token;
    }

    getAuthStatus() {
        return {
            authenticated: this.isAuthenticated(),
            user: this.user,
            repoOwner: this.repoOwner,
            repoName: this.repoName
        };
    }
}