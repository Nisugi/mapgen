// GitHub Token Manager - handles personal access token storage
export class TokenManager {
    constructor() {
        this.tokenKey = 'github_token';
        this.userKey = 'github_user';
    }

    // Store token securely (as secure as localStorage can be)
    storeToken(token) {
        try {
            // In a real app, you might want to encrypt this
            localStorage.setItem(this.tokenKey, token);
            return true;
        } catch (error) {
            console.warn('Failed to store GitHub token:', error);
            return false;
        }
    }

    // Retrieve stored token
    getToken() {
        try {
            return localStorage.getItem(this.tokenKey);
        } catch (error) {
            console.warn('Failed to retrieve GitHub token:', error);
            return null;
        }
    }

    // Clear stored token
    clearToken() {
        try {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            return true;
        } catch (error) {
            console.warn('Failed to clear GitHub token:', error);
            return false;
        }
    }

    // Store user info
    storeUser(user) {
        try {
            localStorage.setItem(this.userKey, JSON.stringify(user));
            return true;
        } catch (error) {
            console.warn('Failed to store GitHub user:', error);
            return false;
        }
    }

    // Get stored user info
    getUser() {
        try {
            const userStr = localStorage.getItem(this.userKey);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.warn('Failed to retrieve GitHub user:', error);
            return null;
        }
    }

    // Validate token format (basic check)
    isValidTokenFormat(token) {
        // GitHub personal access tokens start with ghp_ (new format) or are 40 chars (old format)
        return /^ghp_[a-zA-Z0-9]{36}$/.test(token) || /^[a-f0-9]{40}$/.test(token);
    }
}