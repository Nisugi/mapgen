// SVG Renderer - coordinates all rendering components
import { SVGBaseRenderer } from './svg-base-renderer.js';
import { ConnectionRenderer } from './connection-renderer.js';
import { RoomRenderer } from './room-renderer.js';
import { LabelRenderer } from './label-renderer.js';

export class SVGRenderer {
    constructor() {
        this.baseRenderer = new SVGBaseRenderer();
        this.connectionRenderer = new ConnectionRenderer();
        this.roomRenderer = new RoomRenderer();
        this.labelRenderer = new LabelRenderer();
        
        this.connectionAnalyzer = null;
    }

    setConnectionAnalyzer(analyzer) {
        this.connectionAnalyzer = analyzer;
        this.connectionRenderer.setConnectionAnalyzer(analyzer);
    }

    createSVG(rooms, positions, roomLookup, groups, config) {
        const edgeLength = config.edgeLength || 60;
        const roomSize = config.roomSize || 15;
        const roomShape = config.roomShape || 'square';
        const strokeWidth = config.strokeWidth || 1;
        const connectionWidth = config.connectionWidth || 2;
        
        // Get SVG container info
        const container = this.baseRenderer.createSVGContainer(rooms, positions, config);
        const { width, height, offsetX, offsetY } = container;
        
        // Start SVG
        let svg = container.svgStart;
        
        // Add background
        svg += this.baseRenderer.renderBackground(width, height, config);
        
        // Draw group labels if enabled
        if (config.showGroupLabels && config.groups) {
            svg += this.baseRenderer.renderGroupLabels(config.groups, offsetX, offsetY, edgeLength, positions, config);
        }
        
        // Draw regular connections
        if (config.showConnections) {
            svg += this.connectionRenderer.renderRegularConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }

        // Draw dashed connector edges (no derivable direction)
        if (config.showConnections && config.showConnectorEdges !== false) {
            svg += this.connectionRenderer.renderConnectorConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }

        // Draw cross-group connection LINES ONLY (no terminals)
        if (config.showConnections) {
            svg += this.connectionRenderer.renderCrossGroupConnectionLines(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }
        
        // Draw custom text boxes if provided
        if (config.customTextBoxes && config.customTextBoxes.length > 0) {
            svg += this.labelRenderer.renderCustomTextBoxes(config.customTextBoxes, offsetX, offsetY, edgeLength, config);
        }
        
        // Draw custom labels if provided
        if (config.customLabels && config.customLabels.length > 0) {
            svg += this.labelRenderer.renderCustomLabels(config.customLabels, offsetX, offsetY, edgeLength, config);
        }
        
        // Draw rooms
        svg += this.roomRenderer.renderRooms(rooms, positions, offsetX, offsetY, edgeLength, roomSize, roomShape, strokeWidth, config);
        
        // Draw cross-group connection TERMINALS ONLY (on top of rooms)
        if (config.showConnections) {
            svg += this.connectionRenderer.renderCrossGroupConnectionTerminals(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }
        
        svg += container.svgEnd;
        return svg;
    }

    // Delegate utility methods to appropriate renderers for compatibility
    getRoomBounds(x, y, roomShape, roomSize) {
        return this.roomRenderer.getRoomBounds(x, y, roomShape, roomSize);
    }

    wrapText(text, maxWidth, fontSize) {
        return this.baseRenderer.wrapText(text, maxWidth, fontSize);
    }
}