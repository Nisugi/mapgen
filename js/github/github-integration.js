// GitHub Integration - Main class that coordinates GitHub functionality
import { TokenManager } from './auth/token-manager.js';
import { MapRepository } from './storage/map-repository.js';
import { eventBus, EVENTS } from '../utils/event-bus.js';

export class GitHubIntegration {
    constructor() {
        this.tokenManager = new TokenManager();
        this.token = this.tokenManager.getToken();
        this.user = this.tokenManager.getUser();
        this.mapRepository = null;
        
        // Repository configuration
        this.repoName = 'mapgen';
        this.repoOwner = this.detectRepoOwner();
        
        // Initialize map repository if authenticated
        if (this.token) {
            this.mapRepository = new MapRepository(this.token, this.repoOwner, this.repoName);
        }
    }

    // Detect repository owner from current URL
    detectRepoOwner() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('github.io')) {
            // Extract username from GitHub Pages URL
            const parts = hostname.split('.');
            if (parts.length >= 3 && parts[1] === 'github') {
                return parts[0]; // username.github.io
            }
        }
        
        // Fallback to main repository
        return 'Nisugi'; // Replace with your GitHub username
    }

    // Authenticate with personal access token
    async authenticate(token = null) {
        // If no token provided, prompt user
        if (!token) {
            token = await this.promptForToken();
            if (!token) {
                throw new Error('No token provided');
            }
        }

        // Validate token format
        if (!this.tokenManager.isValidTokenFormat(token)) {
            throw new Error('Invalid token format. Please use a valid GitHub personal access token.');
        }

        // Create temporary repository to test token
        const testRepo = new MapRepository(token, this.repoOwner, this.repoName);
        
        try {
            // Verify token works
            const user = await testRepo.api.getCurrentUser();
            
            // Check repository access
            const access = await testRepo.api.checkAccess();
            
            if (!access.exists) {
                throw new Error(`Repository ${this.repoOwner}/${this.repoName} not found. Please fork the repository first.`);
            }
            
            if (!access.canWrite) {
                throw new Error('No write access to repository. Please check your token permissions.');
            }
            
            // Store token and user
            this.tokenManager.storeToken(token);
            this.tokenManager.storeUser(user);
            
            // Update instance properties
            this.token = token;
            this.user = user;
            this.mapRepository = testRepo;
            
            // If this is a fork, update the owner
            if (access.owner !== this.repoOwner) {
                this.repoOwner = access.owner;
                this.mapRepository = new MapRepository(token, this.repoOwner, this.repoName);
            }
            
            // Emit success event
            eventBus.emit(EVENTS.GITHUB_AUTH_SUCCESS, { user });

            // Force UI update
            if (window.app) {
                window.app.updateGitHubStatus();
            }
            
            return true;
            
        } catch (error) {
            // Clear any stored token if authentication fails
            this.tokenManager.clearToken();
            
            // Emit failure event
            eventBus.emit(EVENTS.GITHUB_AUTH_FAILURE, { error: error.message });

            // Force UI update
            if (window.app) {
                window.app.updateGitHubStatus();
            }
            
            throw error;
        }
    }

    // Prompt user for token
    async promptForToken() {
        const message = `Please enter your GitHub Personal Access Token.

To create a token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Elanthia Map Generator")
4. Select the "repo" scope (full control of private repositories)
5. Click "Generate token"
6. Copy the token (it starts with "ghp_")

Note: The token will only be stored in your browser's local storage.`;

        return prompt(message);
    }

    // Logout
    logout() {
        this.tokenManager.clearToken();
        this.token = null;
        this.user = null;
        this.mapRepository = null;
    }

    // Check if authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get authentication status
    getAuthStatus() {
        return {
            authenticated: this.isAuthenticated(),
            user: this.user,
            repoOwner: this.repoOwner,
            repoName: this.repoName
        };
    }

    // Save map set to GitHub
    async saveMapSet(mapName, location, svgContent, coordsContent, configContent) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please connect to GitHub first.');
        }
        
        if (!mapName || !location) {
            throw new Error('Map name and location are required');
        }
        
        // Clean up the map name (remove special characters)
        mapName = mapName.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        try {
            const results = await this.mapRepository.saveMapSet(
                mapName,
                location,
                svgContent,
                coordsContent,
                configContent
            );
            
            // Emit save event
            eventBus.emit(EVENTS.GITHUB_SAVE, {
                mapName,
                location,
                results
            });
            
            return results;
            
        } catch (error) {
            console.error('Failed to save map set:', error);
            throw error;
        }
    }

    // Load map set from GitHub
    async loadMapSet(mapName, location) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please connect to GitHub first.');
        }
        
        try {
            const results = await this.mapRepository.loadMapSet(mapName, location);
            
            // Emit load event
            eventBus.emit(EVENTS.GITHUB_LOAD, {
                mapName,
                location,
                results
            });
            
            return results;
            
        } catch (error) {
            console.error('Failed to load map set:', error);
            throw error;
        }
    }

    // List all available maps
    async listMaps() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please connect to GitHub first.');
        }
        
        try {
            return await this.mapRepository.listMaps();
        } catch (error) {
            console.error('Failed to list maps:', error);
            throw error;
        }
    }

    // Delete a map set
    async deleteMapSet(mapName, location) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please connect to GitHub first.');
        }
        
        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete the map "${mapName}" from ${location}? This cannot be undone.`);
        if (!confirmed) {
            return { cancelled: true };
        }
        
        try {
            return await this.mapRepository.deleteMapSet(mapName, location);
        } catch (error) {
            console.error('Failed to delete map set:', error);
            throw error;
        }
    }

    // Get current user info
    async getCurrentUser() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        
        try {
            const user = await this.mapRepository.api.getCurrentUser();
            this.user = user;
            this.tokenManager.storeUser(user);
            return user;
        } catch (error) {
            console.error('Failed to get current user:', error);
            throw error;
        }
    }

    // Check rate limit
    async checkRateLimit() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        
        try {
            return await this.mapRepository.api.getRateLimit();
        } catch (error) {
            console.error('Failed to check rate limit:', error);
            throw error;
        }
    }

    // Detect location from room data
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
        
        // Map common location names to folder names
        const locationMap = {
            "Sailor's Grief": 'sailors_grief',
            "Hinterwildes": 'hinterwildes',
            "Icemule Trace": 'icemule',
            "Wehnimer's Landing": 'wehnimers',
            "Solhaven": 'solhaven',
            "River's Rest": 'rivers_rest',
            "Ta'Vaalor": 'ta_vaalor',
            "Ta'Illistim": 'ta_illistim',
            "Kharam Dzu": 'kharam_dzu',
            "Zul Logoth": 'zul_logoth',
            "Cysaegir": 'cysaegir',
            "Kraken's Fall": 'krakens_fall',
            "Mist Harbor": 'mist_harbor',
            "Four Winds Isle": 'four_winds',
            "Teras Isle": 'teras',
            "unknown": 'custom'
        };
        
        // Convert to filename-safe format
        const folderName = locationMap[primaryLocation] || 
                          primaryLocation.toLowerCase()
                                       .replace(/[^a-z0-9]/g, '_')
                                       .replace(/_+/g, '_')
                                       .replace(/^_|_$/g, '');
        
        return folderName || 'custom';
    }
}