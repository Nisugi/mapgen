// Map Generator Module - coordinates map generation
import { RoomPositioner } from './generation/room-positioner.js';
import { SVGRenderer } from './generation/svg-renderer.js';
import { ConnectionAnalyzer } from './generation/connection-analyzer.js';
import { ClusterPacker } from './generation/cluster-packer.js';
import { InteriorClassifier } from './generation/interior-classifier.js';
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
        this.clusterPacker = new ClusterPacker(this.connectionAnalyzer);
        this.interiorClassifier = new InteriorClassifier();
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
        const groups = positionResult.groups;

        // Step 2.5: Split interiors (shops, lockers, wagons) from the outdoor
        // map. They render on a separate interiors sheet; the outdoor room
        // that hosts the doorway gets a door marker.
        let outdoorGroups = groups;
        let interiorGroups = [];
        let entranceRoomIds = null;

        if (this.config.separateInteriors !== false) {
            const classification = this.interiorClassifier.classify(groups, roomLookup);
            const candidates = groups.filter(g => classification.interiorGroups.has(g.index));
            const remaining = groups.filter(g => !classification.interiorGroups.has(g.index));

            // A selection that is entirely interiors (mapping a single
            // building) should render as a normal map.
            if (candidates.length > 0 && remaining.length > 0) {
                interiorGroups = candidates;
                outdoorGroups = remaining;
                entranceRoomIds = classification.entranceRoomIds;

                for (const group of interiorGroups) {
                    if (!group.name) {
                        const building = this.interiorClassifier.buildingName(group) || `Interior ${group.index + 1}`;
                        const via = classification.entrances.get(group.index)?.[0];
                        group.name = via ? `${building} (via ${via.outdoorRoomId})` : building;
                    }
                }
            }
        }

        // Step 3: Pack groups relative to each other (image anchors,
        // connector adjacency, uid tiebreaks). Sets group.baseOffset, which
        // GroupManager respects instead of its left-to-right strip.
        if (this.config.packClusters !== false) {
            this.clusterPacker.packGroups(outdoorGroups, roomLookup, groups);
        }

        // Step 4: Apply group offsets and render the outdoor map
        const groupPixelModes = config.groupPixelModes || new Map();
        const finalPositions = this.groupManager.applyGroupOffsets(outdoorGroups, this.config, groupPixelModes);
        const outdoorRooms = outdoorGroups.flatMap(g => g.rooms);
        const outdoorConfig = entranceRoomIds ? { ...this.config, entranceRoomIds } : this.config;
        const svg = this.svgRenderer.createSVG(outdoorRooms, finalPositions, roomLookup, outdoorGroups, outdoorConfig);

        // Step 5: Render the interiors sheet
        let interiorSvg = null;
        if (interiorGroups.length > 0) {
            this.clusterPacker.packInteriorShelf(interiorGroups);
            const interiorPositions = this.groupManager.applyGroupOffsets(interiorGroups, this.config, groupPixelModes);
            const interiorRooms = interiorGroups.flatMap(g => g.rooms);
            const interiorConfig = {
                ...this.config,
                showGroupLabels: true,
                groups: interiorGroups,
                backgroundImage: null
            };
            interiorSvg = this.svgRenderer.createSVG(interiorRooms, interiorPositions, roomLookup, interiorGroups, interiorConfig);
        }

        return { svg, interiorSvg, groups };
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