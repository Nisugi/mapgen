#!/usr/bin/env node
// Headless layout runner — exercises the positioning pipeline outside the browser
// and compares the current algorithm against the legacy (pre-grid-ripping) one.
//
// Usage:
//   node tools/headless-layout.mjs [location] [--mapdb <path>] [--out <dir>]
//
// Examples:
//   node tools/headless-layout.mjs Moonsedge
//   node tools/headless-layout.mjs "Icemule Trace" --out ./layout-tests

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// connection-analyzer reads window.app?.config in label paths
globalThis.window = globalThis.window ?? {};

const { ConnectionAnalyzer } = await import('../js/generation/connection-analyzer.js');
const { RoomPositioner } = await import('../js/generation/room-positioner.js');
const { ClusterPacker } = await import('../js/generation/cluster-packer.js');

const scriptDir = dirname(fileURLToPath(import.meta.url));

// --- CLI args ---
const args = process.argv.slice(2);
let location = 'Moonsedge';
let mapdbPath = join(scriptDir, '..', 'mapdb.json');
let outDir = join(scriptDir, '..', 'layout-tests');

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mapdb') mapdbPath = args[++i];
    else if (args[i] === '--out') outDir = args[++i];
    else location = args[i];
}

// --- Load and select rooms ---
console.log(`Loading mapdb from ${resolve(mapdbPath)}...`);
const mapdb = JSON.parse(readFileSync(mapdbPath, 'utf-8'));
const rooms = mapdb.filter(r => r && r.location === location);
if (rooms.length === 0) {
    console.error(`No rooms found for location "${location}"`);
    process.exit(1);
}
console.log(`${rooms.length} rooms in "${location}"`);

const roomLookup = new Map();
rooms.forEach(room => roomLookup.set(room.id, room));

// --- Legacy algorithm replica (pre-grid-ripping), for comparison only ---
const LEGACY_DIRECTION_ORDER = [
    'north', 'south', 'east', 'west',
    'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down'
];

function legacyDirection(room, targetId) {
    if (room.dirto && room.dirto[targetId]) {
        const d = room.dirto[targetId].toLowerCase().trim();
        if (d === 'cross-group') return null;
        if (d !== 'none' && d !== 'skip' && LEGACY_DIRECTION_ORDER.includes(d)) return d;
    }
    if (room.wayto && room.wayto[targetId] && typeof room.wayto[targetId] === 'string') {
        const w = room.wayto[targetId].toLowerCase().trim();
        if (w.startsWith(';e')) return null;
        if (LEGACY_DIRECTION_ORDER.includes(w)) return w;
        // legacy bug preserved: substring match, shortest names checked first
        for (const direction of LEGACY_DIRECTION_ORDER) {
            if (w.includes(direction)) return direction;
        }
    }
    return null;
}

const DIRECTION_OFFSETS = {
    north: { x: 0, y: -1 }, south: { x: 0, y: 1 },
    east: { x: 1, y: 0 }, west: { x: -1, y: 0 },
    northeast: { x: 1, y: -1 }, northwest: { x: -1, y: -1 },
    southeast: { x: 1, y: 1 }, southwest: { x: -1, y: 1 },
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, out: { x: 1, y: 0 }
};

function legacyPositions(rooms, roomLookup) {
    const groups = [];
    const unpositioned = new Set(rooms.map(r => r.id));
    const occupied = (positions, x, y) =>
        Array.from(positions.values()).some(p => p.x === x && p.y === y);

    while (unpositioned.size > 0) {
        let nextStart = null;
        let best = 0;
        for (const roomId of unpositioned) {
            const room = roomLookup.get(roomId);
            if (!room || !room.wayto) continue;
            const n = Object.keys(room.wayto)
                .filter(t => legacyDirection(room, t) && roomLookup.has(parseInt(t))).length;
            if (n > best) { best = n; nextStart = room; }
        }
        if (!nextStart) nextStart = roomLookup.get(Array.from(unpositioned)[0]);

        const componentPositions = new Map();
        const componentRooms = [];
        const queue = [{ room: nextStart, x: 0, y: 0 }];
        componentPositions.set(nextStart.id, { x: 0, y: 0 });
        componentRooms.push(nextStart);
        unpositioned.delete(nextStart.id);

        while (queue.length > 0) {
            const { room, x, y } = queue.shift();
            if (!room.wayto) continue;
            for (const targetId of Object.keys(room.wayto)) {
                const targetRoom = roomLookup.get(parseInt(targetId));
                if (!targetRoom || !unpositioned.has(targetRoom.id)) continue;
                const direction = legacyDirection(room, targetId);
                if (!direction) continue;
                const offset = DIRECTION_OFFSETS[direction];
                if (!offset) continue;
                let newX = x + offset.x;
                let newY = y + offset.y;
                let attempts = 0;
                while (occupied(componentPositions, newX, newY) && attempts < 8) {
                    switch (attempts) {
                        case 0: newX += 1; break;
                        case 1: newX -= 2; break;
                        case 2: newX += 1; newY += 1; break;
                        case 3: newY -= 2; break;
                        case 4: newX += 2; break;
                        case 5: newX -= 4; break;
                        case 6: newY += 3; break;
                        case 7: newX += 2; newY += 2; break;
                    }
                    attempts++;
                }
                if (!occupied(componentPositions, newX, newY)) {
                    componentPositions.set(targetRoom.id, { x: newX, y: newY });
                    componentRooms.push(targetRoom);
                    unpositioned.delete(targetRoom.id);
                    queue.push({ room: targetRoom, x: newX, y: newY });
                }
            }
        }
        groups.push({ index: groups.length, rooms: componentRooms, positions: componentPositions });
    }
    return groups;
}

// --- Run both algorithms ---
const analyzer = new ConnectionAnalyzer();
const positioner = new RoomPositioner(analyzer);

// silence the positioner's per-room console noise for batch runs
const realLog = console.log;
console.log = () => {};
const current = positioner.calculateRoomPositionsWithGroups(rooms, roomLookup);
console.log = realLog;

const packer = new ClusterPacker(analyzer);
packer.packGroups(current.groups, roomLookup);

const legacyGroups = legacyPositions(rooms, roomLookup);
// validate legacy layout with the same validator (using legacy directions)
const legacyAnalyzerShim = { getDirectionForConnection: (room, t) => legacyDirection(room, t) };
const legacyValidator = new RoomPositioner(legacyAnalyzerShim);
for (const g of legacyGroups) {
    g.violations = legacyValidator.validateComponent(g.rooms, g.positions, roomLookup);
}

// --- Stats ---
function stats(groups) {
    const singletons = groups.filter(g => g.rooms.length === 1).length;
    const violations = groups.reduce((n, g) => n + (g.violations?.length ?? 0), 0);
    const placed = groups.reduce((n, g) => n + g.rooms.length, 0);
    return { components: groups.length, singletons, violations, placed };
}

const newStats = stats(current.groups);
const oldStats = stats(legacyGroups);

console.log('');
console.log(`${'metric'.padEnd(24)}${'legacy'.padEnd(10)}current`);
console.log(`${'components'.padEnd(24)}${String(oldStats.components).padEnd(10)}${newStats.components}`);
console.log(`${'singleton components'.padEnd(24)}${String(oldStats.singletons).padEnd(10)}${newStats.singletons}`);
console.log(`${'direction violations'.padEnd(24)}${String(oldStats.violations).padEnd(10)}${newStats.violations}`);

console.log('\n--- cluster packing ---');
console.log(`primary image: ${packer.lastPackInfo.primaryImage ?? '(none)'}`);
console.log(`scale: ${packer.lastPackInfo.scale.toFixed(1)} px/cell`);
console.log(`placement methods:`, packer.lastPackInfo.methods);

// --- SVG output ---
const CELL = 60;
const ROOM = 22;
const PAD = 3; // cells between groups

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSVG(groups, roomLookup, directionFn) {
    // packed groups carry baseOffset; otherwise lay out left-to-right, largest first
    const finalPositions = new Map();
    if (groups.every(g => g.baseOffset)) {
        for (const g of groups) {
            for (const [id, p] of g.positions) {
                finalPositions.set(id, { x: p.x + g.baseOffset.x, y: p.y + g.baseOffset.y });
            }
        }
    } else {
        const sorted = [...groups].sort((a, b) => b.rooms.length - a.rooms.length);
        let cursorX = 0;
        for (const g of sorted) {
            const xs = [...g.positions.values()].map(p => p.x);
            const ys = [...g.positions.values()].map(p => p.y);
            const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs);
            for (const [id, p] of g.positions) {
                finalPositions.set(id, { x: p.x - minX + cursorX, y: p.y - minY });
            }
            cursorX += (maxX - minX + 1) + PAD;
        }
    }

    // normalize to non-negative
    const allX = [...finalPositions.values()].map(p => p.x);
    const allY = [...finalPositions.values()].map(p => p.y);
    const shiftX = -Math.min(...allX), shiftY = -Math.min(...allY);
    for (const p of finalPositions.values()) { p.x += shiftX; p.y += shiftY; }

    const width = (Math.max(...allX) + shiftX + 2) * CELL;
    const height = (Math.max(...allY) + shiftY + 2) * CELL;
    const px = p => ({ x: (p.x + 1) * CELL, y: (p.y + 1) * CELL });

    const MAX_CONNECTOR_CELLS = 30;
    let edges = '';
    let nodes = '';
    const drawn = new Set();

    const violationKeys = new Set();
    for (const g of groups) {
        for (const v of g.violations ?? []) violationKeys.add([v.from, v.to].sort().join('-'));
    }

    // edges: directional solid (violations red), connectors dashed — including inter-group
    for (const room of rooms) {
        const pos = finalPositions.get(room.id);
        if (!pos || !room.wayto) continue;
        const { x, y } = px(pos);
        for (const targetId of Object.keys(room.wayto)) {
            const tid = parseInt(targetId);
            const tpos = finalPositions.get(tid);
            if (!tpos) continue;
            const key = [room.id, tid].sort().join('-');
            if (drawn.has(key)) continue;
            drawn.add(key);
            const t = px(tpos);
            const direction = directionFn(room, targetId);
            if (direction) {
                const bad = violationKeys.has(key);
                edges += `<line x1="${x}" y1="${y}" x2="${t.x}" y2="${t.y}" stroke="${bad ? '#d33' : '#666'}" stroke-width="${bad ? 3 : 2}"/>`;
            } else {
                const cellDist = Math.max(Math.abs(pos.x - tpos.x), Math.abs(pos.y - tpos.y));
                if (cellDist > MAX_CONNECTOR_CELLS) continue;
                edges += `<line x1="${x}" y1="${y}" x2="${t.x}" y2="${t.y}" stroke="#aaa" stroke-width="1.5" stroke-dasharray="4,3"/>`;
            }
        }
    }

    for (const room of rooms) {
        const pos = finalPositions.get(room.id);
        if (!pos) continue;
        const { x, y } = px(pos);
        const title = room.title?.[0] ?? '';
        nodes += `<rect x="${x - ROOM / 2}" y="${y - ROOM / 2}" width="${ROOM}" height="${ROOM}" fill="#fff" stroke="#333" stroke-width="1"><title>${esc(title)}</title></rect>`;
        nodes += `<text x="${x}" y="${y + 3}" font-size="8" font-family="Arial" text-anchor="middle">${room.id}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<rect width="${width}" height="${height}" fill="#f8f9fa"/>${edges}${nodes}</svg>`;
}

mkdirSync(outDir, { recursive: true });
const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '_');

const newSVG = renderSVG(current.groups, roomLookup, (r, t) => analyzer.getDirectionForConnection(r, t, roomLookup));
const oldSVG = renderSVG(legacyGroups, roomLookup, legacyDirection);

writeFileSync(join(outDir, `${slug}-current.svg`), newSVG);
writeFileSync(join(outDir, `${slug}-legacy.svg`), oldSVG);
console.log(`\nSVGs written to ${resolve(outDir)}\\${slug}-current.svg and ${slug}-legacy.svg`);
