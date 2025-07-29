// Default configuration for the map generator
export const DEFAULT_CONFIG = {
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
    tagColors: new Map(),
    options: {
        showRoomIds: true,
        showRoomNames: false,
        showCardinalLabels: false,
        showLabels: true,
        showConnections: true,
        showGroupLabels: false
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

export function createConfig() {
    // Deep clone the config but preserve Map instances
    const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    
    // Restore Map instances that were lost in JSON serialization
    config.tagColors = new Map(DEFAULT_CONFIG.tagColors);
    
    return config;
}