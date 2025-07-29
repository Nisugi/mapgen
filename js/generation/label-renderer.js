// Label Renderer - handles custom labels and text boxes
export class LabelRenderer {
    constructor() {
        // No dependencies
    }

    renderCustomLabels(labels, offsetX, offsetY, edgeLength, config) {
        let svg = '';
        
        if (!labels || labels.length === 0) return svg;
        
        labels.forEach(label => {
            const x = (label.x / config.edgeLength + offsetX) * edgeLength;
            const y = (label.y / config.edgeLength + offsetY) * edgeLength;
            
            const fontWeight = label.bold ? 'bold' : 'normal';
            
            if (label.background) {
                // Estimate text width for background
                const textWidth = label.text.length * label.fontSize * 0.6 + 10;
                const textHeight = label.fontSize + 6;
                
                svg += `<rect x="${x - textWidth/2}" y="${y - textHeight/2}" 
                        width="${textWidth}" height="${textHeight}" 
                        fill="${label.backgroundColor}" 
                        stroke="${label.borderColor}" 
                        stroke-width="${label.borderWidth}" 
                        rx="2" ry="2"/>`;
            }
            
            svg += `<text x="${x}" y="${y}" text-anchor="middle" 
                    font-size="${label.fontSize}" fill="${label.fontColor}" 
                    font-family="${label.fontFamily}" font-weight="${fontWeight}"
                    dominant-baseline="middle"
                    transform="rotate(${label.rotation || 0} ${x} ${y})">${label.text}</text>`;
        });
        
        return svg;
    }

    renderCustomTextBoxes(textBoxes, offsetX, offsetY, edgeLength, config) {
        let svg = '<g id="custom-textboxes">';
        
        if (!textBoxes || textBoxes.length === 0) {
            svg += '</g>';
            return svg;
        }
        
        textBoxes.forEach(textBox => {
            // Text boxes use grid coordinates, same as labels
            const x = textBox.x;
            const y = textBox.y;
            const width = textBox.width;
            const height = textBox.height;
            const padding = textBox.padding || 10;
            
            // Create group for the text box with rotation
            svg += `<g transform="rotate(${textBox.rotation || 0} ${x + width/2} ${y + height/2})" opacity="${textBox.opacity || 1}">`;
            
            // Draw background rectangle
            const strokeDasharray = {
                'solid': '',
                'dashed': 'stroke-dasharray="5,5"',
                'dotted': 'stroke-dasharray="2,3"',
                'double': ''
            };
            
            if (textBox.borderStyle === 'double' && textBox.borderWidth > 0) {
                // Draw double border
                const outerBorderWidth = textBox.borderWidth;
                const innerBorderWidth = Math.max(1, textBox.borderWidth - 2);
                const gap = 2;
                
                // Outer border
                svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
                        fill="none" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${outerBorderWidth}"
                        rx="${textBox.borderRadius || 0}" ry="${textBox.borderRadius || 0}"/>`;
                
                // Inner border
                svg += `<rect x="${x + gap + outerBorderWidth/2}" y="${y + gap + outerBorderWidth/2}" 
                        width="${width - 2*gap - outerBorderWidth}" height="${height - 2*gap - outerBorderWidth}" 
                        fill="${textBox.backgroundColor}" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${innerBorderWidth}"
                        rx="${Math.max(0, (textBox.borderRadius || 0) - gap)}" 
                        ry="${Math.max(0, (textBox.borderRadius || 0) - gap)}"/>`;
            } else {
                // Single border
                svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
                        fill="${textBox.backgroundColor}" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${textBox.borderWidth}"
                        ${strokeDasharray[textBox.borderStyle] || ''}
                        rx="${textBox.borderRadius || 0}" ry="${textBox.borderRadius || 0}"/>`;
            }
            
            // Create text content
            svg += `<text text-anchor="${this.getTextAnchor(textBox.textAlign)}">`;
            
            let currentY = y + padding;
            const lineHeight = 1.2; // Line height multiplier
            
            // Calculate total text height for vertical alignment
            let totalTextHeight = 0;
            textBox.content.forEach(segment => {
                totalTextHeight += segment.fontSize * lineHeight;
                if (segment.lineBreak) {
                    totalTextHeight += segment.fontSize * 0.5; // Extra space for line breaks
                }
            });
            
            // Adjust starting Y based on vertical alignment
            if (textBox.verticalAlign === 'middle') {
                currentY = y + (height - totalTextHeight) / 2 + padding;
            } else if (textBox.verticalAlign === 'bottom') {
                currentY = y + height - totalTextHeight - padding;
            }
            
            // Render each text segment
            textBox.content.forEach((segment, index) => {
                const fontWeight = segment.bold ? 'bold' : 'normal';
                const fontStyle = segment.italic ? 'italic' : 'normal';
                const fontSize = segment.fontSize || 12;
                
                // Calculate X position based on alignment
                let textX = x + padding;
                if (textBox.textAlign === 'center') {
                    textX = x + width / 2;
                } else if (textBox.textAlign === 'right') {
                    textX = x + width - padding;
                }
                
                currentY += fontSize; // Move to baseline position
                
                svg += `<tspan x="${textX}" y="${currentY}" 
                        font-size="${fontSize}" 
                        font-family="${segment.fontFamily}" 
                        font-weight="${fontWeight}"
                        font-style="${fontStyle}"
                        fill="${segment.fontColor}">${this.escapeXml(segment.text)}</tspan>`;
                
                // Add line break if specified
                if (segment.lineBreak && index < textBox.content.length - 1) {
                    currentY += fontSize * 0.5; // Extra space for line break
                }
            });
            
            svg += '</text>';
            svg += '</g>'; // Close transform group
        });
        
        svg += '</g>'; // Close textboxes group
        return svg;
    }

    getTextAnchor(align) {
        switch (align) {
            case 'center': return 'middle';
            case 'right': return 'end';
            case 'justify':
            case 'left':
            default: return 'start';
        }
    }
    
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}