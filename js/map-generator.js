// Map Generator Module - coordinates map generation
import { RoomPositioner } from './generation/room-positioner.js';
import { SVGRenderer } from './generation/svg-renderer.js';
import { ConnectionAnalyzer } from './generation/connection-analyzer.js';
import { GroupManager } from './generation/group-manager.js';

export class MapGenerator {
    constructor() {
        this.config = {
            colors: {
                default: '#ffffff',
                background: '#f8f9fa',
                connections: '#666666',
                verticalConnections: '#999999'
            },
            showRoomIds: true,
            showRoomNames: false,
            showLabels: true,
            showConnections: true,
            edgeLength: 60,
            roomShape: 'square',
            roomSize: 15,
            strokeWidth: 1,
            connectionWidth: 2,
            fonts: {
                labels: {
                    size: 8,
                    color: '#444',
                    family: 'Arial',
                    bold: false
                },
                rooms: {
                    size: 10,
                    color: '#000',
                    family: 'Arial', 
                    bold: false
                }
            }
        };
        
        // Initialize sub-modules
        this.connectionAnalyzer = new ConnectionAnalyzer();
        this.roomPositioner = new RoomPositioner(this.connectionAnalyzer);
        this.groupManager = new GroupManager();
        this.svgRenderer = new SVGRenderer();
        this.svgRenderer.setConnectionAnalyzer(this.connectionAnalyzer);
    }

    generateMap(rooms, config = {}) {
        const result = this.generateMapWithGroups(rooms, config);
        return result.svg;
    }

    generateMapWithGroups(rooms, config = {}) {
        console.log('Generating map for', rooms.length, 'rooms');
        
        // Merge config
        this.config = { ...this.config, ...config };
        
        // Step 1: Build room lookup
        const roomLookup = new Map();
        rooms.forEach(room => roomLookup.set(room.id, room));
        
        // Step 2: Position rooms based on connections and get group info
        const positionResult = this.roomPositioner.calculateRoomPositionsWithGroups(rooms, roomLookup);
        const positions = positionResult.positions;
        const groups = positionResult.groups;
        
        // Step 3: Apply group offsets
        const groupPixelModes = config.groupPixelModes || new Map();
        const finalPositions = this.groupManager.applyGroupOffsets(groups, this.config, groupPixelModes);
        
        // Step 4: Generate SVG
        const svg = this.svgRenderer.createSVG(rooms, finalPositions, roomLookup, groups, this.config);
        
        return { svg, groups };
    }

    // Delegate methods to sub-modules for compatibility
    getRoomBounds(x, y, roomShape, roomSize) {
        return this.svgRenderer.getRoomBounds(x, y, roomShape, roomSize);
    }

    getDirectionForConnection(room, targetId) {
        return this.connectionAnalyzer.getDirectionForConnection(room, targetId);
    }

    getConnectionLabel(room, targetId) {
        return this.connectionAnalyzer.getConnectionLabel(room, targetId);
    }

    isVerticalConnection(room, targetId) {
        return this.connectionAnalyzer.isVerticalConnection(room, targetId);
    }

    isCrossGroupConnection(room, targetId) {
        return this.connectionAnalyzer.isCrossGroupConnection(room, targetId);
    }

    getBoundingBox(positions) {
        return this.groupManager.getBoundingBox(positions);
    }

    calculateRoomPositions(rooms, roomLookup) {
        const result = this.calculateRoomPositionsWithGroups(rooms, roomLookup);
        return result.positions;
    }

    calculateRoomPositionsWithGroups(rooms, roomLookup) {
        return this.roomPositioner.calculateRoomPositionsWithGroups(rooms, roomLookup);
    }

    applyGroupOffsets(groups, groupPixelModes = new Map()) {
        return this.groupManager.applyGroupOffsets(groups, this.config, groupPixelModes);
    }

    isPositionOccupied(positions, x, y) {
        return this.roomPositioner.isPositionOccupied(positions, x, y);
    }

    wrapText(text, maxWidth, fontSize) {
        return this.svgRenderer.wrapText(text, maxWidth, fontSize);
    }

    createSVG(rooms, positions, roomLookup) {
        return this.svgRenderer.createSVG(rooms, positions, roomLookup, [], this.config);
    }
}