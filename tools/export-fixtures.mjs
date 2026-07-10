#!/usr/bin/env node
// Generates docs/layout-fixtures.json - statistical validation targets for
// ports of the layout engine (see docs/layout-engine-spec.md §9).
//
// Usage: node tools/export-fixtures.mjs [--mapdb <path>]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

globalThis.window = globalThis.window ?? {};

const { ConnectionAnalyzer } = await import('../js/generation/connection-analyzer.js');
const { RoomPositioner } = await import('../js/generation/room-positioner.js');
const { ClusterPacker } = await import('../js/generation/cluster-packer.js');
const { InteriorClassifier } = await import('../js/generation/interior-classifier.js');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mapdbPath = args.includes('--mapdb') ? args[args.indexOf('--mapdb') + 1] : join(scriptDir, '..', 'mapdb.json');

const ZONES = ['Moonsedge', 'the Atoll', 'Mist Harbor', 'Icemule Trace', "Wehnimer's Landing", 'Solhaven', "Ta'Illistim"];

const db = JSON.parse(readFileSync(mapdbPath, 'utf-8'));
const fixtures = { generated: new Date().toISOString(), note: 'Statistical targets; small drift from iteration order is fine, large drift is a logic bug.', zones: {} };

for (const location of ZONES) {
    const rooms = db.filter(r => r && r.location === location);
    if (rooms.length === 0) continue;
    const lookup = new Map(rooms.map(r => [r.id, r]));

    const analyzer = new ConnectionAnalyzer();
    const positioner = new RoomPositioner(analyzer);
    const realLog = console.log, realWarn = console.warn;
    console.log = () => {}; console.warn = () => {};
    const t0 = Date.now();
    const { groups } = positioner.calculateRoomPositionsWithGroups(rooms, lookup);
    const classification = new InteriorClassifier().classify(groups, lookup);
    let outdoor = groups.filter(g => !classification.interiorGroups.has(g.index));
    let interiors = groups.filter(g => classification.interiorGroups.has(g.index));
    if (outdoor.length === 0) { outdoor = groups; interiors = []; }
    const packer = new ClusterPacker(analyzer);
    packer.packGroups(outdoor, lookup, groups);
    packer.packInteriorShelf(interiors);
    const ms = Date.now() - t0;
    console.log = realLog; console.warn = realWarn;

    // invariants
    const fin = new Map(), compOf = new Map();
    for (const g of outdoor) for (const [id, p] of g.positions) {
        fin.set(id, { x: p.x + g.baseOffset.x, y: p.y + g.baseOffset.y });
        compOf.set(id, g.index);
    }
    const cells = new Set();
    let overlaps = 0;
    for (const p of fin.values()) {
        const key = `${p.x},${p.y}`;
        if (cells.has(key)) overlaps++;
        cells.add(key);
    }

    const connectorLens = [];
    const seen = new Set();
    for (const r of rooms) {
        for (const t of Object.keys(r.wayto ?? {})) {
            const tid = parseInt(t);
            if (!fin.has(tid) || !fin.has(r.id) || compOf.get(r.id) === compOf.get(tid)) continue;
            const key = [r.id, tid].sort().join('-');
            if (seen.has(key)) continue;
            seen.add(key);
            const a = fin.get(r.id), b = fin.get(tid);
            connectorLens.push(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)));
        }
    }
    connectorLens.sort((a, b) => a - b);
    const q = f => connectorLens.length ? connectorLens[Math.floor(connectorLens.length * f)] ?? connectorLens[connectorLens.length - 1] : null;

    fixtures.zones[location] = {
        rooms: rooms.length,
        components: groups.length,
        outdoorComponents: outdoor.length,
        outdoorRooms: outdoor.reduce((n, g) => n + g.rooms.length, 0),
        interiorComponents: interiors.length,
        interiorRooms: interiors.reduce((n, g) => n + g.rooms.length, 0),
        directionViolations: groups.reduce((n, g) => n + (g.violations?.length ?? 0), 0),
        entranceRooms: classification.entranceRoomIds.size,
        cellOverlaps: overlaps,
        interGroupConnectors: connectorLens.length,
        connectorLenMedian: q(0.5),
        connectorLenP90: q(0.9),
        packMethods: packer.lastPackInfo.methods,
        primaryImage: packer.lastPackInfo.primaryImage,
        jsMs: ms
    };
    console.log(`${location}: ${rooms.length} rooms, ${ms}ms, overlaps=${overlaps}`);
}

const outPath = join(scriptDir, '..', 'docs', 'layout-fixtures.json');
writeFileSync(outPath, JSON.stringify(fixtures, null, 2));
console.log(`\nWrote ${outPath}`);
