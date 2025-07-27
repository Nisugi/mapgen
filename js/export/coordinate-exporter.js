// Coordinate Exporter - handles room coordinate exports
export class CoordinateExporter {
    constructor(mapGenerator) {
        this.mapGenerator = mapGenerator;
    }

    generateCoordinates(rooms, uiState, config, outputName) {
        // Get the same config as generate/preview
        const groupsWithNames = uiState.groupData.groups.map((group, index) => ({
            ...group,
            name: uiState.groupData.names.get(index) || `Group ${index + 1}`
        }));
        
        const mapConfig = {
            edgeLength: config.edgeLength,
            roomShape: config.roomShape,
            roomSize: config.roomSize,
            groupOffsets: uiState.groupData.offsets,
            groups: groupsWithNames
        };
        
        // Generate positions
        const result = this.mapGenerator.generateMapWithGroups(rooms, mapConfig);
        const positions = this.mapGenerator.calculateRoomPositionsWithGroups(
            rooms, 
            new Map(rooms.map(r => [r.id, r]))
        ).positions;
        
        // Calculate actual positions with offsets
        const finalPositions = this.mapGenerator.applyGroupOffsets(result.groups);
        
        // Get bounds for offset calculation
        const coords = Array.from(finalPositions.values());
        const minX = Math.min(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const padding = 2;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;
        
        // Generate coordinate data
        let coordData = [];
        rooms.forEach(room => {
            const pos = finalPositions.get(room.id);
            if (pos) {
                const x = (pos.x + offsetX) * mapConfig.edgeLength;
                const y = (pos.y + offsetY) * mapConfig.edgeLength;
                const bounds = this.mapGenerator.getRoomBounds(x, y, mapConfig.roomShape, mapConfig.roomSize);
                
                coordData.push({
                    id: room.id,
                    image: outputName + '.png',
                    image_coords: [
                        Math.round(bounds.left),
                        Math.round(bounds.top),
                        Math.round(bounds.right),
                        Math.round(bounds.bottom)
                    ]
                });
            }
        });
        
        return coordData;
    }

    showExportWindow(coordData, outputName) {
        const exportWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        
        // Format the data for mapdb
        let mapdbFormat = coordData.map(room => {
            return `  "${room.id}": {\n` +
                   `    "image": "${room.image}",\n` +
                   `    "image_coords": [${room.image_coords.join(', ')}]\n` +
                   `  }`;
        }).join(',\n');
        
        exportWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Room Coordinates Export</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    h2 { color: #333; }
                    .export-container {
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        padding: 20px;
                        margin-bottom: 20px;
                    }
                    textarea {
                        width: 100%;
                        height: 400px;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        border: 1px solid #ccc;
                        padding: 10px;
                    }
                    button {
                        background: #5a67d8;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 10px;
                    }
                    button:hover {
                        background: #4c51bf;
                    }
                    .info {
                        background: #e6f3ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <h2>Room Coordinates Export</h2>
                <div class="info">
                    <strong>Image name:</strong> ${outputName}.png<br>
                    <strong>Total rooms:</strong> ${coordData.length}<br>
                    <strong>Format:</strong> MapDB image_coords format (left, top, right, bottom)
                </div>
                <div class="export-container">
                    <h3>MapDB Format (for room definitions):</h3>
                    <textarea id="mapdb-format" readonly>{
${mapdbFormat}
}</textarea>
                    <button onclick="document.getElementById('mapdb-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy MapDB Format</button>
                </div>
                <div class="export-container">
                    <h3>JSON Format (for reference):</h3>
                    <textarea id="json-format" readonly>${JSON.stringify(coordData, null, 2)}</textarea>
                    <button onclick="document.getElementById('json-format').select(); document.execCommand('copy'); alert('Copied to clipboard!');">Copy JSON Format</button>
                </div>
            </body>
            </html>
        `);
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}