// GitHub Repository API - handles repository operations
import { GitHubAPIClient } from './api-client.js';

export class RepositoryAPI extends GitHubAPIClient {
    constructor(token, owner, repo) {
        super(token);
        this.owner = owner;
        this.repo = repo;
    }

    // Get repository info
    async getRepository() {
        return this.get(`/repos/${this.owner}/${this.repo}`);
    }

    // Check if user has write access
    async checkAccess() {
        try {
            const repo = await this.getRepository();
            return {
                exists: true,
                canWrite: repo.permissions?.push || repo.permissions?.admin || false,
                isFork: repo.fork || false,
                defaultBranch: repo.default_branch || 'main',
                owner: repo.owner.login
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return { 
                    exists: false, 
                    canWrite: false,
                    error: 'Repository not found'
                };
            }
            throw error;
        }
    }

    // Get repository contents
    async getContents(path = '', ref = 'main') {
        const endpoint = `/repos/${this.owner}/${this.repo}/contents/${path}`;
        const params = ref ? `?ref=${ref}` : '';
        return this.get(endpoint + params);
    }

    // Get a single file
    async getFile(path, ref = 'main') {
        try {
            const response = await this.getContents(path, ref);
            
            if (response.type !== 'file') {
                throw new Error('Path is not a file');
            }

            // Decode base64 content
            const content = this.decodeContent(response.content);
            
            return {
                content,
                sha: response.sha,
                path: response.path,
                size: response.size
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    // Create or update a file
    async saveFile(path, content, message, branch = 'main', sha = null) {
        const data = {
            message,
            content: this.encodeContent(content),
            branch
        };

        if (sha) {
            data.sha = sha; // Required for updates
        }

        return this.put(`/repos/${this.owner}/${this.repo}/contents/${path}`, data);
    }

    // Delete a file
    async deleteFile(path, message, sha, branch = 'main') {
        const data = {
            message,
            sha,
            branch
        };

        return this.delete(`/repos/${this.owner}/${this.repo}/contents/${path}`, data);
    }

    // List files in a directory
    async listFiles(path = '', ref = 'main') {
        try {
            const contents = await this.getContents(path, ref);
            
            if (!Array.isArray(contents)) {
                throw new Error('Path is not a directory');
            }

            return contents.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type,
                size: item.size,
                sha: item.sha
            }));
        } catch (error) {
            if (error.message.includes('404')) {
                return [];
            }
            throw error;
        }
    }

    // Create multiple files in a single commit (requires more complex API usage)
    async saveMultipleFiles(files, message, branch = 'main') {
        // For now, we'll save them one by one
        // In the future, this could use the Git Trees API for atomic commits
        const results = [];
        
        for (const file of files) {
            try {
                const result = await this.saveFile(
                    file.path,
                    file.content,
                    message,
                    branch,
                    file.sha
                );
                results.push({ success: true, path: file.path, result });
            } catch (error) {
                results.push({ success: false, path: file.path, error: error.message });
            }
        }
        
        return results;
    }

    // Utility methods
    encodeContent(content) {
        // Encode UTF-8 content to base64
        return btoa(unescape(encodeURIComponent(content)));
    }

    decodeContent(base64) {
        // Decode base64 to UTF-8 content
        return decodeURIComponent(escape(atob(base64)));
    }
}