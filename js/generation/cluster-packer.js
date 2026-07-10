// Cluster Packer - positions connected components relative to each other.
//
// Components are placed by, in priority order:
//   1. image_coords anchors - the old hand-drawn map overlays carry pixel
//      positions for many rooms; components anchored on the location's
//      primary image are placed by their coordinate centroids.
//   2. connector edges - "go door"/"climb"/script edges between components
//      prove physical adjacency, so unanchored components are packed next
//      to their already-placed neighbors (smallest uid delta wins ties,
//      since uids encode construction order ~ spatial locality).
//   3. strip fallback - anything isolated lines up below the map.
//
// Output: sets group.baseOffset (grid cells) and group.packing (debug info).
// GroupManager only computes its own left-to-right strip when baseOffset is
// missing, so manual per-group offsets still layer on top of packed output.
export class ClusterPacker {
    constructor(connectionAnalyzer) {
        this.connectionAnalyzer = connectionAnalyzer;
        this.defaultScale = 30;   // px per grid cell when estimation has no data
        this.groupPadding = 3;    // cells between strip-placed groups
        this.searchRadius = 30;   // max spiral distance when resolving collisions
    }

    packGroups(groups, roomLookup) {
        if (!groups || groups.length === 0) return;

        const componentOf = new Map();
        groups.forEach(g => g.rooms.forEach(r => componentOf.set(r.id, g.index)));
        // group.index is global; when packing a subset it is not an array position
        const groupByIndex = new Map(groups.map(g => [g.index, g]));

        const edges = this.collectConnectorEdges(groups, roomLookup, componentOf);
        const anchors = this.collectAnchors(groups);
        const primaryImage = this.findPrimaryImage(groups, anchors);
        const scale = this.estimateScale(groups, anchors, primaryImage);

        const occupied = new Set();
        const placed = new Set();
        // Connector lines already committed to the layout, so later
        // placements can avoid crossing them.
        const placedSegments = [];
        const commitSegments = (group) => {
            for (const e of (edges.get(group.index) ?? [])) {
                if (!placed.has(e.otherGroup)) continue;
                const a = this.finalCell(group, e.roomId);
                const b = this.finalCell(groupByIndex.get(e.otherGroup), e.otherRoomId);
                if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 30) continue;
                placedSegments.push({ a, b, ra: e.roomId, rb: e.otherRoomId });
            }
        };

        // --- Pass 1: image-anchored groups ---
        if (primaryImage) {
            const anchoredGroups = groups
                .filter(g => (anchors.get(g.index) ?? []).some(a => a.image === primaryImage))
                .sort((a, b) => {
                    const na = anchors.get(a.index).filter(x => x.image === primaryImage).length;
                    const nb = anchors.get(b.index).filter(x => x.image === primaryImage).length;
                    return nb - na || b.rooms.length - a.rooms.length;
                });

            for (const group of anchoredGroups) {
                const groupAnchors = anchors.get(group.index).filter(a => a.image === primaryImage);
                let sumX = 0, sumY = 0;
                for (const a of groupAnchors) {
                    const internal = group.positions.get(a.roomId);
                    sumX += a.px / scale - internal.x;
                    sumY += a.py / scale - internal.y;
                }
                const proposed = {
                    x: Math.round(sumX / groupAnchors.length),
                    y: Math.round(sumY / groupAnchors.length)
                };
                const offset = this.findFreeOffset(group, proposed, occupied);
                if (offset) {
                    this.placeGroup(group, offset, occupied, placed, { method: 'image', image: primaryImage });
                    commitSegments(group);
                }
            }
        }

        // --- Pass 2: connector-attached groups, BFS outward from placed ones.
        // When the reachable set is exhausted but connector-connected groups
        // remain (super-clusters with no image anchors), seed the largest one
        // below the current map and keep going.
        if (placed.size === 0) {
            const largest = [...groups].sort((a, b) => b.rooms.length - a.rooms.length)[0];
            this.placeGroup(largest, { x: 0, y: 0 }, occupied, placed, { method: 'seed' });
        }

        const deferred = new Set();
        while (true) {
            let best = null;
            for (const group of groups) {
                if (placed.has(group.index) || deferred.has(group.index)) continue;
                const placedEdges = (edges.get(group.index) ?? []).filter(e => placed.has(e.otherGroup));
                if (placedEdges.length === 0) continue;
                const minUidDelta = Math.min(...placedEdges.map(e => e.uidDelta));
                if (!best ||
                    placedEdges.length > best.placedEdges.length ||
                    (placedEdges.length === best.placedEdges.length && minUidDelta < best.minUidDelta)) {
                    best = { group, placedEdges, minUidDelta };
                }
            }

            if (!best) {
                // Nothing touches the placed set; seed the next unreached
                // connector super-cluster below the current map.
                const seedGroup = groups
                    .filter(g => !placed.has(g.index) && !deferred.has(g.index) && (edges.get(g.index) ?? []).length > 0)
                    .sort((a, b) => b.rooms.length - a.rooms.length)[0];
                if (!seedGroup) break;
                const bounds = this.groupBounds(seedGroup);
                const extent = this.occupiedBounds(occupied);
                const proposed = {
                    x: extent.minX - bounds.minX,
                    y: extent.maxY + this.groupPadding - bounds.minY
                };
                const offset = this.findFreeOffset(seedGroup, proposed, occupied) ?? proposed;
                this.placeGroup(seedGroup, offset, occupied, placed, { method: 'seed' });
                commitSegments(seedGroup);
                continue;
            }

            // Pack next to the neighbor most likely to be physically adjacent
            const edge = best.placedEdges.sort((a, b) => a.uidDelta - b.uidDelta)[0];
            const neighborGroup = groupByIndex.get(edge.otherGroup);
            const neighborCell = this.finalCell(neighborGroup, edge.otherRoomId);
            const internal = best.group.positions.get(edge.roomId);

            // All connector lines this placement will create - the candidate
            // spot must keep them short and avoid crossing existing ones
            const anchors = best.placedEdges.map(e => ({
                internal: best.group.positions.get(e.roomId),
                target: this.finalCell(groupByIndex.get(e.otherGroup), e.otherRoomId),
                roomId: e.roomId,
                otherRoomId: e.otherRoomId
            }));

            const proposed = { x: neighborCell.x - internal.x, y: neighborCell.y - internal.y };
            const offset = this.findBestConnectorOffset(best.group, proposed, occupied, anchors, placedSegments);
            if (offset) {
                this.placeGroup(best.group, offset, occupied, placed, {
                    method: 'connector',
                    via: { from: edge.roomId, to: edge.otherRoomId }
                });
                commitSegments(best.group);
            } else {
                // No room nearby; leave it for the strip pass and keep going
                deferred.add(best.group.index);
            }
        }

        // --- Pass 3: strip fallback for whatever is left ---
        const leftovers = groups.filter(g => !placed.has(g.index))
            .sort((a, b) => b.rooms.length - a.rooms.length);
        if (leftovers.length > 0) {
            let maxY = 0, minX = 0;
            for (const key of occupied) {
                const [x, y] = key.split(',').map(Number);
                if (y > maxY) maxY = y;
                if (x < minX) minX = x;
            }
            let cursorX = minX;
            const stripY = maxY + this.groupPadding;
            for (const group of leftovers) {
                const bounds = this.groupBounds(group);
                const proposed = { x: cursorX - bounds.minX, y: stripY - bounds.minY };
                const offset = this.findFreeOffset(group, proposed, occupied) ?? proposed;
                this.placeGroup(group, offset, occupied, placed, { method: 'strip' });
                cursorX += bounds.width + this.groupPadding;
            }
        }

        this.lastPackInfo = {
            primaryImage,
            scale,
            methods: groups.reduce((acc, g) => {
                const m = g.packing?.method ?? 'none';
                acc[m] = (acc[m] ?? 0) + 1;
                return acc;
            }, {})
        };
    }

    // Connector edges: any wayto between rooms of different components.
    // These carry no direction but prove adjacency.
    collectConnectorEdges(groups, roomLookup, componentOf) {
        const edges = new Map(); // groupIndex -> [{otherGroup, roomId, otherRoomId, uidDelta}]
        const addEdge = (g, other, roomId, otherRoomId, uidDelta) => {
            if (!edges.has(g)) edges.set(g, []);
            edges.get(g).push({ otherGroup: other, roomId, otherRoomId, uidDelta });
        };

        for (const group of groups) {
            for (const room of group.rooms) {
                if (!room.wayto) continue;
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const otherGroup = componentOf.get(targetIdNum);
                    if (otherGroup === undefined || otherGroup === group.index) continue;
                    const target = roomLookup.get(targetIdNum);
                    const uidDelta = this.uidDelta(room, target);
                    addEdge(group.index, otherGroup, room.id, targetIdNum, uidDelta);
                }
            }
        }
        return edges;
    }

    uidDelta(a, b) {
        const ua = Array.isArray(a?.uid) && a.uid.length ? a.uid[0] : null;
        const ub = Array.isArray(b?.uid) && b.uid.length ? b.uid[0] : null;
        return ua != null && ub != null ? Math.abs(ua - ub) : Number.MAX_SAFE_INTEGER;
    }

    collectAnchors(groups) {
        const anchors = new Map(); // groupIndex -> [{roomId, image, px, py}]
        for (const group of groups) {
            const list = [];
            for (const room of group.rooms) {
                if (room.image && Array.isArray(room.image_coords) && room.image_coords.length === 4) {
                    const [x1, y1, x2, y2] = room.image_coords;
                    list.push({ roomId: room.id, image: room.image, px: (x1 + x2) / 2, py: (y1 + y2) / 2 });
                }
            }
            if (list.length > 0) anchors.set(group.index, list);
        }
        return anchors;
    }

    // The geographic base map is whatever image anchors the largest component.
    // Raw per-room counts can be fooled by collage overlays (e.g. "homes"
    // images that tile many separate interiors onto one sheet).
    findPrimaryImage(groups, anchors) {
        const largestAnchored = groups
            .filter(g => anchors.has(g.index))
            .sort((a, b) => b.rooms.length - a.rooms.length)[0];
        if (!largestAnchored) return null;

        const counts = new Map();
        for (const a of anchors.get(largestAnchored.index)) {
            counts.set(a.image, (counts.get(a.image) ?? 0) + 1);
        }
        let bestImage = null, bestCount = 0;
        for (const [image, count] of counts) {
            if (count > bestCount) { bestImage = image; bestCount = count; }
        }
        return bestImage;
    }

    occupiedBounds(occupied) {
        let minX = 0, maxY = 0;
        for (const key of occupied) {
            const comma = key.indexOf(',');
            const x = Number(key.slice(0, comma));
            const y = Number(key.slice(comma + 1));
            if (x < minX) minX = x;
            if (y > maxY) maxY = y;
        }
        return { minX, maxY };
    }

    // Pixels per grid cell, estimated from room pairs WITHIN a component:
    // their relative grid positions are solver-trusted, their pixel positions
    // are cartographer-trusted, so the ratio recovers the drawing's scale.
    estimateScale(groups, anchors, primaryImage) {
        if (!primaryImage) return this.defaultScale;
        const ratios = [];

        for (const group of groups) {
            const list = (anchors.get(group.index) ?? []).filter(a => a.image === primaryImage);
            if (list.length < 2) continue;
            const limit = Math.min(list.length, 20); // cap the O(n^2) pair walk
            for (let i = 0; i < limit; i++) {
                for (let j = i + 1; j < limit; j++) {
                    const pa = group.positions.get(list[i].roomId);
                    const pb = group.positions.get(list[j].roomId);
                    const gridDx = Math.abs(pa.x - pb.x);
                    const gridDy = Math.abs(pa.y - pb.y);
                    const pixDx = Math.abs(list[i].px - list[j].px);
                    const pixDy = Math.abs(list[i].py - list[j].py);
                    if (gridDx >= 1 && gridDx <= 50) ratios.push(pixDx / gridDx);
                    if (gridDy >= 1 && gridDy <= 50) ratios.push(pixDy / gridDy);
                }
            }
        }

        if (ratios.length === 0) return this.defaultScale;
        ratios.sort((a, b) => a - b);
        const median = ratios[Math.floor(ratios.length / 2)];
        return Math.min(300, Math.max(5, median));
    }

    // Interiors sheet: wrapped shelf rows in an independent coordinate space,
    // sorted by name so related buildings sit together.
    packInteriorShelf(groups) {
        if (!groups || groups.length === 0) return;
        const sorted = [...groups].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

        const totalArea = sorted.reduce((sum, g) => {
            const b = this.groupBounds(g);
            return sum + b.width * b.height;
        }, 0);
        const rowWidth = Math.max(20, Math.ceil(Math.sqrt(totalArea) * 1.5));

        let cursorX = 0, cursorY = 0, rowHeight = 0;
        for (const group of sorted) {
            const bounds = this.groupBounds(group);
            if (cursorX > 0 && cursorX + bounds.width > rowWidth) {
                cursorY += rowHeight + this.groupPadding;
                cursorX = 0;
                rowHeight = 0;
            }
            group.baseOffset = { x: cursorX - bounds.minX, y: cursorY - bounds.minY };
            group.packing = { method: 'interior-shelf' };
            cursorX += bounds.width + this.groupPadding;
            rowHeight = Math.max(rowHeight, bounds.height);
        }
    }

    groupBounds(group) {
        const coords = [...group.positions.values()];
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    finalCell(group, roomId) {
        const internal = group.positions.get(roomId);
        return { x: internal.x + group.baseOffset.x, y: internal.y + group.baseOffset.y };
    }

    fits(group, offset, occupied) {
        for (const pos of group.positions.values()) {
            if (occupied.has(`${pos.x + offset.x},${pos.y + offset.y}`)) return false;
        }
        return true;
    }

    // Connector-aware placement: among collision-free offsets near the
    // proposed one, prefer short connector lines that cross as few existing
    // connector lines as possible. Explores two rings past the nearest fit
    // so a clean spot can beat a marginally closer tangled one.
    findBestConnectorOffset(group, proposed, occupied, anchors, placedSegments) {
        let best = null;
        let bestScore = Infinity;
        let firstFitRadius = null;

        const consider = (candidate) => {
            if (!this.fits(group, candidate, occupied)) return;
            let score = 0;
            for (const anchor of anchors) {
                const x = anchor.internal.x + candidate.x;
                const y = anchor.internal.y + candidate.y;
                score += Math.max(Math.abs(x - anchor.target.x), Math.abs(y - anchor.target.y));
                for (const seg of placedSegments) {
                    if (seg.ra === anchor.roomId || seg.rb === anchor.roomId ||
                        seg.ra === anchor.otherRoomId || seg.rb === anchor.otherRoomId) continue;
                    if (this.segmentsCross({ x, y }, anchor.target, seg.a, seg.b)) {
                        score += 1000;
                    }
                }
            }
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        };

        consider(proposed);
        for (let r = 1; r <= this.searchRadius; r++) {
            if (best && firstFitRadius === null) firstFitRadius = r - 1;
            if (firstFitRadius !== null && r > firstFitRadius + 2) break;
            for (let dx = -r; dx <= r; dx++) {
                for (const dy of (Math.abs(dx) === r ? this.range(-r, r) : [-r, r])) {
                    consider({ x: proposed.x + dx, y: proposed.y + dy });
                }
            }
        }
        return best;
    }

    segmentsCross(a1, b1, a2, b2) {
        const orient = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
        const o1 = orient(a1.x, a1.y, b1.x, b1.y, a2.x, a2.y);
        const o2 = orient(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y);
        const o3 = orient(a2.x, a2.y, b2.x, b2.y, a1.x, a1.y);
        const o4 = orient(a2.x, a2.y, b2.x, b2.y, b1.x, b1.y);
        return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
    }

    // Nearest collision-free offset to the proposed one, spiraling outward.
    findFreeOffset(group, proposed, occupied) {
        if (this.fits(group, proposed, occupied)) return proposed;
        for (let r = 1; r <= this.searchRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (const dy of (Math.abs(dx) === r ? this.range(-r, r) : [-r, r])) {
                    const candidate = { x: proposed.x + dx, y: proposed.y + dy };
                    if (this.fits(group, candidate, occupied)) return candidate;
                }
            }
        }
        return null;
    }

    range(from, to) {
        const out = [];
        for (let i = from; i <= to; i++) out.push(i);
        return out;
    }

    placeGroup(group, offset, occupied, placed, packing) {
        group.baseOffset = { x: offset.x, y: offset.y };
        group.packing = packing;
        placed.add(group.index);
        for (const pos of group.positions.values()) {
            occupied.add(`${pos.x + offset.x},${pos.y + offset.y}`);
        }
    }
}
