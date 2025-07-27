// Simple event bus for inter-component communication
export class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        
        const index = this.events[event].indexOf(callback);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
}

// Create singleton instance
export const eventBus = new EventBus();

// Define event names as constants
export const EVENTS = {
    // Map generation events
    MAP_GENERATE: 'map:generate',
    MAP_PREVIEW: 'map:preview',
    MAP_GENERATED: 'map:generated',
    
    // Room selection events
    ROOM_SELECTION_CHANGED: 'rooms:selection:changed',
    ROOMS_SELECTED: 'rooms:selected',
    
    // Config events
    CONFIG_CHANGED: 'config:changed',
    THEME_CHANGED: 'theme:changed',
    
    // Group events
    GROUP_OFFSET_CHANGED: 'group:offset:changed',
    GROUP_NAME_CHANGED: 'group:name:changed',
    GROUP_LABEL_OFFSET_CHANGED: 'group:label:offset:changed',
    
    // Cross-group connection events
    CROSS_CONNECTION_ADDED: 'cross:connection:added',
    CROSS_CONNECTION_REMOVED: 'cross:connection:removed',
    CROSS_CONNECTION_UPDATED: 'cross:connection:updated',
    
    // Custom label events
    CUSTOM_LABEL_ADDED: 'label:added',
    CUSTOM_LABEL_REMOVED: 'label:removed',
    CUSTOM_LABEL_UPDATED: 'label:updated',
    
    // Export events
    EXPORT_SVG: 'export:svg',
    EXPORT_COORDS: 'export:coords',
    EXPORT_CONFIG: 'export:config',
    
    // GitHub events
    GITHUB_AUTH_SUCCESS: 'github:auth:success',
    GITHUB_AUTH_FAILURE: 'github:auth:failure',
    GITHUB_SAVE: 'github:save',
    GITHUB_LOAD: 'github:load',
    
    // Status events
    STATUS_UPDATE: 'status:update',
    PROGRESS_UPDATE: 'progress:update',
    ERROR: 'error'
};