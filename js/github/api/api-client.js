// GitHub API Client - base class for API interactions
export class GitHubAPIClient {
    constructor(token) {
        this.token = token;
        this.apiBase = 'https://api.github.com';
        this.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Elanthia-Map-Generator'
        };
        
        if (token) {
            this.headers['Authorization'] = `token ${token}`;
        }
    }

    // Update token
    setToken(token) {
        this.token = token;
        if (token) {
            this.headers['Authorization'] = `token ${token}`;
        } else {
            delete this.headers['Authorization'];
        }
    }

    // Make API request
    async request(method, endpoint, data = null) {
        const url = `${this.apiBase}${endpoint}`;
        const options = {
            method,
            headers: { ...this.headers }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        // Handle rate limiting
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        
        if (remaining === '0') {
            const resetDate = new Date(parseInt(reset) * 1000);
            throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
        }

        // Handle empty responses (like 204 No Content)
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    }

    // Convenience methods
    async get(endpoint) {
        return this.request('GET', endpoint);
    }

    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }

    async put(endpoint, data) {
        return this.request('PUT', endpoint, data);
    }

    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    // Test if token is valid
    async verifyToken() {
        try {
            await this.get('/user');
            return true;
        } catch (error) {
            return false;
        }
    }

    // Get current user
    async getCurrentUser() {
        return this.get('/user');
    }

    // Get rate limit status
    async getRateLimit() {
        const response = await this.get('/rate_limit');
        return response.rate;
    }
}