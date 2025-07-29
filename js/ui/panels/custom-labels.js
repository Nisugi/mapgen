// Custom Labels Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class CustomLabelsPanel {
    constructor(config) {
        this.config = config;
        this.labels = [];
        this.container = null;
    }

    init() {
        this.container = document.getElementById('custom-labels-list');
        
        // Setup add button
        const addBtn = document.getElementById('add-custom-label');
        if (addBtn) {
            addBtn.addEventListener('click', this.addLabel.bind(this));
        }
        
        this.update();
    }

    addLabel() {
        const text = document.getElementById('custom-label-text').value.trim();
        
        if (!text) {
            alert('Please enter label text');
            return;
        }
        
        // Add label with default settings
        const newLabel = {
            text: text,
            x: 50, // Default position
            y: 50,
            fontSize: 12,
            fontColor: '#000000',
            fontFamily: 'Arial',
            bold: false,
            italic: false,
            underline: false,
            rotation: 0,
            background: true,
            backgroundColor: this.config.colors.background,
            borderColor: this.config.colors.connections,
            borderWidth: 1
        };
        
        this.labels.push(newLabel);
        
        // Clear input
        document.getElementById('custom-label-text').value = '';
        
        // Update UI and emit event
        this.update();
        eventBus.emit(EVENTS.CUSTOM_LABEL_ADDED, { label: newLabel });
    }

    update() {
        if (!this.container) return;
        
        if (this.labels.length === 0) {
            this.container.innerHTML = '<p class="empty-message">No custom labels defined</p>';
            return;
        }
        
        let html = '<div class="label-list">';
        
        this.labels.forEach((label, index) => {
            html += `
                <div class="label-item" data-index="${index}">
                    <div class="label-header">
                        <input type="text" class="label-text-input" data-index="${index}" 
                               value="${label.text}">
                        <button class="btn-small remove-label" data-index="${index}">REMOVE</button>
                    </div>
                    <div class="label-position">
                        X: <input type="number" class="label-x" data-index="${index}" 
                                  value="${label.x}" min="-1000" max="1000" style="width: 70px;">
                        Y: <input type="number" class="label-y" data-index="${index}" 
                                  value="${label.y}" min="-1000" max="1000" style="width: 70px;">
                        Rotation: <input type="number" class="label-rotation" data-index="${index}" 
                                         value="${label.rotation || 0}" min="-180" max="180" style="width: 60px;">
                    </div>
                    <div class="label-format">
                        Size: <input type="number" class="label-size" data-index="${index}" 
                                     value="${label.fontSize}" min="8" max="48" style="width: 50px;">
                        <select class="label-font" data-index="${index}" style="width: 120px;">
                            <option value="Arial" ${label.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Times New Roman" ${label.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Courier New" ${label.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Georgia" ${label.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Verdana" ${label.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                        </select>
                        <input type="color" class="label-color" data-index="${index}" 
                               value="${label.fontColor}" style="width: 30px; height: 25px;">
                        <label><input type="checkbox" class="label-bold" data-index="${index}" 
                                ${label.bold ? 'checked' : ''}> B</label>
                        <label><input type="checkbox" class="label-italic" data-index="${index}" 
                                ${label.italic ? 'checked' : ''}> I</label>
                        <label><input type="checkbox" class="label-underline" data-index="${index}" 
                                ${label.underline ? 'checked' : ''}> U</label>
                    </div>
                    <div class="label-background">
                        <label><input type="checkbox" class="label-has-background" data-index="${index}" 
                                ${label.background ? 'checked' : ''}> Background</label>
                        Color: <input type="color" class="label-bg-color" data-index="${index}" 
                                      value="${label.backgroundColor}" style="width: 30px; height: 25px;" 
                                      ${!label.background ? 'disabled' : ''}>
                        Border: <input type="color" class="label-border-color" data-index="${index}" 
                                       value="${label.borderColor}" style="width: 30px; height: 25px;"
                                       ${!label.background ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Text inputs
        this.container.querySelectorAll('.label-text-input').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.labels[index].text = input.value;
                this.emitUpdate(index);
            });
        });

        // Remove buttons
        this.container.querySelectorAll('.remove-label').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const removed = this.labels[index];
                this.labels.splice(index, 1);
                this.update();
                eventBus.emit(EVENTS.CUSTOM_LABEL_REMOVED, { label: removed, index });
            });
        });

        // Position controls
        this.setupNumberInputs('.label-x', 'x');
        this.setupNumberInputs('.label-y', 'y');
        this.setupNumberInputs('.label-size', 'fontSize');
        this.setupNumberInputs('.label-rotation', 'rotation');

        // Font controls
        this.container.querySelectorAll('.label-font').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.labels[index].fontFamily = select.value;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.labels[index].fontColor = input.value;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-bold').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.labels[index].bold = checkbox.checked;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-italic').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.labels[index].italic = checkbox.checked;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-underline').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.labels[index].underline = checkbox.checked;
                this.emitUpdate(index);
            });
        });

        // Background controls
        this.container.querySelectorAll('.label-has-background').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                this.labels[index].background = checkbox.checked;
                this.update(); // Re-render to enable/disable controls
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-bg-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.labels[index].backgroundColor = input.value;
                this.emitUpdate(index);
            });
        });

        this.container.querySelectorAll('.label-border-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.labels[index].borderColor = input.value;
                this.emitUpdate(index);
            });
        });
    }

    setupNumberInputs(selector, property) {
        this.container.querySelectorAll(selector).forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                const value = parseInt(input.value) || 0;
                this.labels[index][property] = value;
                this.emitUpdate(index);
            });
        });
    }

    emitUpdate(index) {
        eventBus.emit(EVENTS.CUSTOM_LABEL_UPDATED, {
            label: this.labels[index],
            index
        });
    }

    getLabels() {
        return [...this.labels];
    }

    setLabels(labels) {
        this.labels = [...labels];
        this.update();
    }
}