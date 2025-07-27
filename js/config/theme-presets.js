// Theme preset definitions
export const THEME_PRESETS = {
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