// Preview Manager - handles preview windows and SVG downloads
export class PreviewManager {
    constructor() {
        this.previewWindow = null;
    }

    ownsWindow(source) {
        return this.previewWindow !== null && source === this.previewWindow;
    }

    // Interactive preview: each outdoor group gets a transparent drag handle;
    // dropping one posts the cell delta back to the opener, which updates the
    // group's offset and regenerates this window in place.
    showInteractivePreview({ svg, interiorSvg, handles, edgeLength }) {
        const outdoor = this.injectHandles(svg, handles, edgeLength);
        const interiors = interiorSvg
            ? `<h3>Interiors</h3><div class="map-container">${interiorSvg}</div>`
            : '';

        if (this.previewWindow && !this.previewWindow.closed &&
            this.previewWindow.document.getElementById('outdoor-map')) {
            const doc = this.previewWindow.document;
            doc.getElementById('outdoor-map').innerHTML = outdoor;
            doc.getElementById('interior-wrap').innerHTML = interiors;
            const status = doc.getElementById('drag-status');
            if (status) status.textContent = 'Updated. Drag a group to reposition it.';
            return;
        }

        this.previewWindow = window.open('', 'mapgen-preview', 'width=1200,height=800,scrollbars=yes');
        this.previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Map Preview - Interactive</title>
                <style>
                    body { margin: 0; padding: 20px; background: #f0f0f0; font-family: Arial, sans-serif; }
                    .map-container { background: white; border: 1px solid #ccc; border-radius: 5px;
                        padding: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: auto; }
                    #drag-status { background: #e6f3ff; padding: 8px 12px; border-radius: 5px; }
                    .group-handle { fill: rgba(0,0,0,0); stroke: transparent; cursor: grab; }
                    .group-handle:hover { stroke: #4a90d9; stroke-dasharray: 6 4; stroke-width: 1.5; }
                    .group-handle.dragging { stroke: #d98a2b; stroke-dasharray: 6 4; stroke-width: 1.5;
                        fill: rgba(217,138,43,0.08); cursor: grabbing; }
                </style>
            </head>
            <body>
                <p id="drag-status">Drag a group to reposition it; the map regenerates on drop. Hover to see group outlines.</p>
                <div class="map-container" id="outdoor-map">${outdoor}</div>
                <div id="interior-wrap">${interiors}</div>
                <script>
                    var drag = null;
                    document.addEventListener('pointerdown', function (e) {
                        var handle = e.target.closest('.group-handle');
                        if (!handle) return;
                        var svgEl = handle.ownerSVGElement;
                        var rect = svgEl.getBoundingClientRect();
                        drag = {
                            handle: handle,
                            scale: rect.width / svgEl.width.baseVal.value,
                            edge: parseFloat(handle.parentNode.getAttribute('data-edge')) || 60,
                            x0: e.clientX,
                            y0: e.clientY
                        };
                        handle.classList.add('dragging');
                        handle.setPointerCapture(e.pointerId);
                        e.preventDefault();
                    });
                    document.addEventListener('pointermove', function (e) {
                        if (!drag) return;
                        var dx = (e.clientX - drag.x0) / drag.scale;
                        var dy = (e.clientY - drag.y0) / drag.scale;
                        drag.handle.setAttribute('transform', 'translate(' + dx + ',' + dy + ')');
                        var cx = Math.round(dx / drag.edge), cy = Math.round(dy / drag.edge);
                        document.getElementById('drag-status').textContent =
                            (drag.handle.querySelector('title')?.textContent || 'group') + ' → ' + cx + ', ' + cy + ' cells';
                    });
                    document.addEventListener('pointerup', function (e) {
                        if (!drag) return;
                        var dx = (e.clientX - drag.x0) / drag.scale;
                        var dy = (e.clientY - drag.y0) / drag.scale;
                        var cx = Math.round(dx / drag.edge), cy = Math.round(dy / drag.edge);
                        drag.handle.classList.remove('dragging');
                        drag.handle.removeAttribute('transform');
                        if ((cx || cy) && window.opener && !window.opener.closed) {
                            document.getElementById('drag-status').textContent =
                                'Applying (' + cx + ', ' + cy + ') and regenerating…';
                            window.opener.postMessage({
                                type: 'mapgen-group-drag',
                                groupIndex: parseInt(drag.handle.getAttribute('data-group-index')),
                                dxCells: cx,
                                dyCells: cy
                            }, '*');
                        } else {
                            document.getElementById('drag-status').textContent = 'No change.';
                        }
                        drag = null;
                    });
                </script>
            </body>
            </html>
        `);
        this.previewWindow.document.close();
    }

    injectHandles(svg, handles, edgeLength) {
        if (!handles || handles.length === 0) return svg;
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        // biggest first, so small groups sit on top and stay grabbable
        const sorted = [...handles].sort((a, b) => (b.w * b.h) - (a.w * a.h));
        let layer = `<g id="drag-handles" data-edge="${edgeLength}">`;
        for (const h of sorted) {
            const label = h.name ? `${h.name} (${h.rooms} rooms)` : `Group ${h.index + 1} (${h.rooms} rooms)`;
            layer += `<rect class="group-handle" data-group-index="${h.index}" x="${h.x}" y="${h.y}" ` +
                `width="${h.w}" height="${h.h}" pointer-events="all"><title>${esc(label)}</title></rect>`;
        }
        layer += '</g>';
        return svg.replace('</svg>', layer + '</svg>');
    }

    showPreview(svgContent) {
        const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Map Preview</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #f0f0f0; 
                        font-family: Arial, sans-serif;
                    }
                    .map-container {
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        padding: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        overflow: auto;
                    }
                </style>
            </head>
            <body>
                <h3>Map Preview - Full Scale</h3>
                <p>Scroll to explore the entire map. Use browser zoom (Ctrl +/-) to adjust size.</p>
                <div class="map-container">
                    ${svgContent}
                </div>
            </body>
            </html>
        `);
    }

    downloadSVG(svgContent, filename) {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showMapPreview(svgContent, mapName, location) {
        const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${mapName} - Preview</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #f0f0f0; 
                        font-family: Arial, sans-serif;
                    }
                    .map-container {
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        padding: 10px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        overflow: auto;
                    }
                    .map-info {
                        background: #e6f3ff;
                        padding: 10px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="map-info">
                    <h3>${mapName}</h3>
                    <p><strong>Location:</strong> ${location}</p>
                    <p>Use browser zoom (Ctrl +/-) to adjust size. Right-click on the map to save the image.</p>
                </div>
                <div class="map-container">
                    ${svgContent}
                </div>
            </body>
            </html>
        `);
    }
}