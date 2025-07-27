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

export function createConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}