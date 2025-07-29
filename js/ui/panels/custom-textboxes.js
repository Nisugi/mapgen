// Custom Text Boxes Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class CustomTextBoxesPanel {
    constructor(config) {
        this.config = config;
        this.textBoxes = [];
        this.container = null;
        this.currentEditingBox = null;
    }

    init() {
        this.container = document.getElementById('custom-textboxes-list');
        
        // Setup add button
        const addBtn = document.getElementById('add-custom-textbox');
        if (addBtn) {
            addBtn.addEventListener('click', this.addTextBox.bind(this));
        }
        
        this.update();
    }

    addTextBox() {
        // Add text box with default settings
        const newTextBox = {
            id: Date.now(), // Unique ID for tracking
            x: 100, // Default position
            y: 100,
            width: 200,
            height: 100,
            padding: 10,
            // Text content with basic formatting
            content: [
                {
                    text: 'New Text Box',
                    fontSize: 12,
                    fontFamily: 'Arial',
                    fontColor: '#000000',
                    bold: false,
                    italic: false,
                    lineBreak: true
                }
            ],
            // Box styling
            backgroundColor: '#ffffff',
            borderColor: '#000000',
            borderWidth: 1,
            borderStyle: 'solid', // solid, dashed, dotted, double
            borderRadius: 0,
            opacity: 1,
            rotation: 0,
            // Text alignment
            textAlign: 'left', // left, center, right, justify
            verticalAlign: 'top' // top, middle, bottom
        };
        
        this.textBoxes.push(newTextBox);
        
        // Update UI and emit event
        this.update();
        eventBus.emit(EVENTS.CUSTOM_TEXTBOX_ADDED, { textBox: newTextBox });
    }

    update() {
        if (!this.container) return;
        
        if (this.textBoxes.length === 0) {
            this.container.innerHTML = '<p class="empty-message">No custom text boxes defined</p>';
            return;
        }
        
        let html = '<div class="textbox-list">';
        
        this.textBoxes.forEach((textBox, index) => {
            const previewText = textBox.content.map(c => c.text).join(' ').substring(0, 30) + '...';
            
            html += `
                <div class="textbox-item" data-index="${index}">
                    <div class="textbox-header">
                        <span class="textbox-preview">${previewText}</span>
                        <button class="btn-small edit-textbox" data-index="${index}">Edit</button>
                        <button class="btn-small remove-textbox" data-index="${index}">Remove</button>
                    </div>
                    <div class="textbox-position">
                        X: <input type="number" class="textbox-x" data-index="${index}" 
                                  value="${textBox.x}" min="-1000" max="5000" style="width: 70px;">
                        Y: <input type="number" class="textbox-y" data-index="${index}" 
                                  value="${textBox.y}" min="-1000" max="5000" style="width: 70px;">
                        W: <input type="number" class="textbox-width" data-index="${index}" 
                                  value="${textBox.width}" min="50" max="500" style="width: 70px;">
                        H: <input type="number" class="textbox-height" data-index="${index}" 
                                  value="${textBox.height}" min="30" max="500" style="width: 70px;">
                    </div>
                    <div class="textbox-style">
                        Style: <select class="textbox-border-style" data-index="${index}" style="width: 80px;">
                            <option value="solid" ${textBox.borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
                            <option value="dashed" ${textBox.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                            <option value="dotted" ${textBox.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                            <option value="double" ${textBox.borderStyle === 'double' ? 'selected' : ''}>Double</option>
                        </select>
                        Width: <input type="number" class="textbox-border-width" data-index="${index}" 
                                      value="${textBox.borderWidth}" min="0" max="10" style="width: 50px;">
                        Radius: <input type="number" class="textbox-border-radius" data-index="${index}" 
                                       value="${textBox.borderRadius}" min="0" max="50" style="width: 50px;">
                    </div>
                    <div class="textbox-style_two">
                        Padding: <input type="number" class="textbox-padding" data-index="${index}" 
                                        value="${textBox.padding}" min="0" max="50" style="width: 50px;">
                        Opacity: <input type="number" class="textbox-opacity" data-index="${index}" 
                                        value="${textBox.opacity}" min="0" max="1" step="0.1" style="width: 60px;">
                        Border: <input type="color" class="textbox-border-color" data-index="${index}" 
                                        value="${textBox.borderColor}" style="width: 30px; height: 25px;">
                    </div>
                    <div class="textbox-align">
                        Background: <input type="color" class="textbox-bg-color" data-index="${index}" 
                                        value="${textBox.backgroundColor}" style="width: 30px; height: 25px;">
                        Align: <select class="textbox-text-align" data-index="${index}" style="width: 80px;">
                            <option value="left" ${textBox.textAlign === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${textBox.textAlign === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${textBox.textAlign === 'right' ? 'selected' : ''}>Right</option>
                            <option value="justify" ${textBox.textAlign === 'justify' ? 'selected' : ''}>Justify</option>
                        </select>
                        Vert-Align: <select class="textbox-vertical-align" data-index="${index}" style="width: 80px;">
                            <option value="top" ${textBox.verticalAlign === 'top' ? 'selected' : ''}>Top</option>
                            <option value="middle" ${textBox.verticalAlign === 'middle' ? 'selected' : ''}>Middle</option>
                            <option value="bottom" ${textBox.verticalAlign === 'bottom' ? 'selected' : ''}>Bottom</option>
                        </select>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Edit buttons
        this.container.querySelectorAll('.edit-textbox').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.openTextEditor(index);
            });
        });

        // Remove buttons
        this.container.querySelectorAll('.remove-textbox').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const removed = this.textBoxes[index];
                this.textBoxes.splice(index, 1);
                this.update();
                eventBus.emit(EVENTS.CUSTOM_TEXTBOX_REMOVED, { textBox: removed, index });
            });
        });

        // Position and size controls
        this.setupNumberInputs('.textbox-x', 'x');
        this.setupNumberInputs('.textbox-y', 'y');
        this.setupNumberInputs('.textbox-width', 'width');
        this.setupNumberInputs('.textbox-height', 'height');
        this.setupNumberInputs('.textbox-border-width', 'borderWidth');
        this.setupNumberInputs('.textbox-border-radius', 'borderRadius');
        this.setupNumberInputs('.textbox-padding', 'padding');
        this.setupNumberInputs('.textbox-opacity', 'opacity');

        // Color controls
        this.container.querySelectorAll('.textbox-bg-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.textBoxes[index].backgroundColor = input.value;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.textbox-border-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.textBoxes[index].borderColor = input.value;
                this.emitUpdate(index);
            });
        });

        // Style controls
        this.container.querySelectorAll('.textbox-border-style').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.textBoxes[index].borderStyle = select.value;
                this.emitUpdate(index);
            });
        });

        // Alignment controls
        this.container.querySelectorAll('.textbox-text-align').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.textBoxes[index].textAlign = select.value;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.textbox-vertical-align').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.textBoxes[index].verticalAlign = select.value;
                this.emitUpdate(index);
            });
        });
    }

    setupNumberInputs(selector, property) {
        this.container.querySelectorAll(selector).forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                const value = parseFloat(input.value) || 0;
                this.textBoxes[index][property] = value;
                this.emitUpdate(index);
            });
        });
    }

    openTextEditor(index) {
        const textBox = this.textBoxes[index];
        this.currentEditingBox = index;
        
        // Create modal for text editing
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.app.uiManager.panels.customTextBoxes.closeTextEditor()"></div>
            <div class="modal-content large-modal">
                <h3>Edit Text Box Content</h3>
                <div class="text-editor">
                    <div class="text-content-list" id="text-content-list">
                        <!-- Text segments will be added here -->
                    </div>
                    <button class="btn-small" onclick="window.app.uiManager.panels.customTextBoxes.addTextSegment()">
                        Add Text Segment
                    </button>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="window.app.uiManager.panels.customTextBoxes.closeTextEditor()">
                        Cancel
                    </button>
                    <button class="btn-primary" onclick="window.app.uiManager.panels.customTextBoxes.saveTextContent()">
                        Save
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate text segments
        this.updateTextContentList(textBox.content);
    }

    updateTextContentList(content) {
        const container = document.getElementById('text-content-list');
        if (!container) return;
        
        let html = '';
        
        content.forEach((segment, index) => {
            html += `
                <div class="text-segment" data-segment="${index}">
                    <div class="segment-controls">
                        <textarea class="segment-text" data-segment="${index}" 
                                  placeholder="Enter text...">${segment.text}</textarea>
                        <div class="segment-formatting">
                            <div class="control-group">
                                <label>Size:</label>
                                <input type="number" class="segment-size" data-segment="${index}" 
                                       value="${segment.fontSize}" min="8" max="48">
                            </div>
                            <div class="control-group">
                                <label>Font:</label>
                                <select class="segment-font" data-segment="${index}">
                                    <option value="Arial" ${segment.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                                    <option value="Times New Roman" ${segment.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times</option>
                                    <option value="Courier New" ${segment.fontFamily === 'Courier New' ? 'selected' : ''}>Courier</option>
                                    <option value="Georgia" ${segment.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                                    <option value="Verdana" ${segment.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color:</label>
                                <input type="color" class="segment-color" data-segment="${index}" 
                                       value="${segment.fontColor}">
                            </div>
                            <div class="control-group">
                                <label><input type="checkbox" class="segment-bold" data-segment="${index}" 
                                        ${segment.bold ? 'checked' : ''}> Bold</label>
                            </div>
                            <div class="control-group">
                                <label><input type="checkbox" class="segment-italic" data-segment="${index}" 
                                        ${segment.italic ? 'checked' : ''}> Italic</label>
                            </div>
                            <div class="control-group">
                                <label><input type="checkbox" class="segment-linebreak" data-segment="${index}" 
                                        ${segment.lineBreak ? 'checked' : ''}> Line Break</label>
                            </div>
                            <button class="btn-small remove-segment" data-segment="${index}">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add event listeners for the editor
        this.attachEditorListeners();
    }

    attachEditorListeners() {
        const container = document.getElementById('text-content-list');
        if (!container) return;
        
        // Remove segment buttons
        container.querySelectorAll('.remove-segment').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.segment);
                const content = [...this.textBoxes[this.currentEditingBox].content];
                content.splice(index, 1);
                this.updateTextContentList(content);
            });
        });
    }

    addTextSegment() {
        if (this.currentEditingBox === null) return;
        
        const content = [...this.textBoxes[this.currentEditingBox].content];
        content.push({
            text: '',
            fontSize: 12,
            fontFamily: 'Arial',
            fontColor: '#000000',
            bold: false,
            italic: false,
            lineBreak: false
        });
        
        this.updateTextContentList(content);
    }

    saveTextContent() {
        if (this.currentEditingBox === null) return;
        
        const container = document.getElementById('text-content-list');
        const segments = container.querySelectorAll('.text-segment');
        const newContent = [];
        
        segments.forEach((segment, index) => {
            newContent.push({
                text: segment.querySelector('.segment-text').value,
                fontSize: parseInt(segment.querySelector('.segment-size').value) || 12,
                fontFamily: segment.querySelector('.segment-font').value,
                fontColor: segment.querySelector('.segment-color').value,
                bold: segment.querySelector('.segment-bold').checked,
                italic: segment.querySelector('.segment-italic').checked,
                lineBreak: segment.querySelector('.segment-linebreak').checked
            });
        });
        
        this.textBoxes[this.currentEditingBox].content = newContent;
        this.emitUpdate(this.currentEditingBox);
        this.update();
        this.closeTextEditor();
    }

    closeTextEditor() {
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
        this.currentEditingBox = null;
    }

    emitUpdate(index) {
        eventBus.emit(EVENTS.CUSTOM_TEXTBOX_UPDATED, {
            textBox: this.textBoxes[index],
            index
        });
    }

    getTextBoxes() {
        return [...this.textBoxes];
    }

    setTextBoxes(textBoxes) {
        this.textBoxes = [...textBoxes];
        this.update();
    }
}