// Group Positioning Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class GroupPositioningPanel {
    constructor() {
        this.container = null;
        this.currentGroups = [];
        this.edgeLength = 120;
        this.groupOffsets = new Map();
        this.groupNames = new Map();
        this.groupLabelOffsets = new Map();
        this.groupLabelBold = new Map();
        this.groupPixelMode = new Map();
    }

    init() {
        this.container = document.getElementById('group-positioning');
        
        // Listen for map generation events
        eventBus.on(EVENTS.MAP_GENERATED, (data) => {
            if (data.groups) {
                this.currentGroups = data.groups;
                this.update();
            }
        });
    }

    setEdgeLength(edgeLength) {
        this.edgeLength = edgeLength;
    }

    updateEdgeLength(edgeLength) {
        this.edgeLength = edgeLength;
    }

    update() {
        if (!this.container) return;
        
        if (this.currentGroups.length === 0) {
            this.container.innerHTML = `
                <div class="group-controls">
                    <!-- Controls would go here if needed -->
                </div>
                <div class="group-list">
                    <p class="empty-message">Generate or preview a map to see groups</p>
                </div>
            `;
            return;
        }
       
        let html = '<div class="group-controls">';
        html += '<h4>Detected Groups:</h4>';
        html += '</div>';
        html += '<div class="group-list">';
        
        this.currentGroups.forEach((group, index) => {
            const offset = this.groupOffsets.get(index) || { x: 0, y: 0 };
            const labelOffset = this.groupLabelOffsets.get(index) || { x: 0, y: 0 };
            const roomCount = group.rooms.length;
            const groupName = this.groupNames.get(index) || `Group ${index + 1}`;
            const pixelMode = this.groupPixelMode.get(index) || false;
            
            html += `
                <div class="group-item" data-group="${index}">
                    <div class="group-header">
                        <input type="text" class="group-name-input" data-group="${index}" 
                               value="${groupName}" placeholder="Group ${index + 1}">
                        <span class="room-count">${roomCount} rooms</span>
                    </div>
                    <div class="offset-controls">
                        <div class="group-position-header">
                            <h5>Group Position</h5>
                            <label class="pixel-mode-toggle">
                                <input type="checkbox" class="pixel-mode" data-group="${index}" ${pixelMode ? 'checked' : ''}> Pixel Mode
                            </label>
                        </div>
                        <div class="offset-control">
                            <label>X Offset:</label>
                            <input type="range" class="x-offset" data-group="${index}" 
                                   min="${pixelMode ? '-2000' : '-100'}" max="${pixelMode ? '2000' : '100'}" value="${offset.x}">
                            <input type="number" class="offset-number x-offset-number" data-group="${index}"
                                   min="${pixelMode ? '-2000' : '-100'}" max="${pixelMode ? '2000' : '100'}" value="${offset.x}">
                            <span class="offset-unit">${pixelMode ? 'px' : 'cells'}</span>
                        </div>
                        <div class="offset-control">
                            <label>Y Offset:</label>
                            <input type="range" class="y-offset" data-group="${index}" 
                                   min="${pixelMode ? '-2000' : '-100'}" max="${pixelMode ? '2000' : '100'}" value="${offset.y}">
                            <input type="number" class="offset-number y-offset-number" data-group="${index}"
                                   min="${pixelMode ? '-2000' : '-100'}" max="${pixelMode ? '2000' : '100'}" value="${offset.y}">
                            <span class="offset-unit">${pixelMode ? 'px' : 'cells'}</span>
                        </div>
                        <div class="label-position-header">
                            <h5>Label Position</h5>
                            <div class="label-format-controls">
                                <label><input type="checkbox" class="label-bold" data-group="${index}" 
                                        ${this.groupLabelBold.get(index) ? 'checked' : ''}> B</label>
                                <label><input type="checkbox" class="label-italic" data-group="${index}" 
                                        ${this.groupLabelItalic?.get(index) ? 'checked' : ''}> I</label>
                                <label><input type="checkbox" class="label-underline" data-group="${index}" 
                                        ${this.groupLabelUnderline?.get(index) ? 'checked' : ''}> U</label>
                            </div>
                        </div>
                        <div class="offset-control">
                            <label>Label X:</label>
                            <input type="range" class="label-x-offset" data-group="${index}" 
                                   min="-50" max="50" value="${labelOffset.x}">
                            <input type="number" class="offset-number label-x-offset-number" data-group="${index}"
                                   min="-50" max="50" value="${labelOffset.x}">
                        </div>
                        <div class="offset-control">
                            <label>Label Y:</label>
                            <input type="range" class="label-y-offset" data-group="${index}" 
                                   min="-50" max="50" value="${labelOffset.y}">
                            <input type="number" class="offset-number label-y-offset-number" data-group="${index}"
                                   min="-50" max="50" value="${labelOffset.y}">
                        </div>
                    </div>
                </div>
            `;
        });
        
        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Group name inputs
        this.container.querySelectorAll('.group-name-input').forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                this.groupNames.set(groupIndex, input.value);
                eventBus.emit(EVENTS.GROUP_NAME_CHANGED, { 
                    groupIndex, 
                    name: input.value 
                });
            });
        });

        // Pixel mode checkboxes
        this.container.querySelectorAll('.pixel-mode').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const groupIndex = parseInt(checkbox.dataset.group);
                const wasPixelMode = this.groupPixelMode.get(groupIndex) || false;
                const isPixelMode = checkbox.checked;
                
                if (wasPixelMode !== isPixelMode) {
                    this.switchPixelMode(groupIndex, isPixelMode);
                }
                
                this.groupPixelMode.set(groupIndex, isPixelMode);
                this.update(); // Re-render to update input ranges
            });
        });

        // Bold checkboxes
        this.container.querySelectorAll('.label-bold').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const groupIndex = parseInt(checkbox.dataset.group);
                this.groupLabelBold.set(groupIndex, checkbox.checked);
                eventBus.emit(EVENTS.GROUP_LABEL_BOLD_CHANGED, {
                    groupIndex,
                    bold: checkbox.checked
                });
            });
        });

        // Italic checkboxes
        this.container.querySelectorAll('.label-italic').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const groupIndex = parseInt(checkbox.dataset.group);
                if (!this.groupLabelItalic) this.groupLabelItalic = new Map();
                this.groupLabelItalic.set(groupIndex, checkbox.checked);
                eventBus.emit(EVENTS.GROUP_LABEL_ITALIC_CHANGED, {
                    groupIndex,
                    italic: checkbox.checked
                });
            });
        });

        // Underline checkboxes
        this.container.querySelectorAll('.label-underline').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const groupIndex = parseInt(checkbox.dataset.group);
                if (!this.groupLabelUnderline) this.groupLabelUnderline = new Map();
                this.groupLabelUnderline.set(groupIndex, checkbox.checked);
                eventBus.emit(EVENTS.GROUP_LABEL_UNDERLINE_CHANGED, {
                    groupIndex,
                    underline: checkbox.checked
                });
            });
        });

        // Position sliders and number inputs
        this.setupOffsetControls('.x-offset', '.x-offset-number', true, false);
        this.setupOffsetControls('.y-offset', '.y-offset-number', false, false);
        this.setupOffsetControls('.label-x-offset', '.label-x-offset-number', true, true);
        this.setupOffsetControls('.label-y-offset', '.label-y-offset-number', false, true);
    }

    setupOffsetControls(sliderClass, numberClass, isX, isLabel) {
        // Slider controls
        this.container.querySelectorAll(sliderClass).forEach(slider => {
            slider.addEventListener('input', () => {
                const groupIndex = parseInt(slider.dataset.group);
                const value = parseInt(slider.value);
                
                if (isLabel) {
                    this.updateLabelOffset(groupIndex, isX, value);
                } else {
                    this.updateGroupOffset(groupIndex, isX, value);
                }
                
                // Update corresponding number input
                const numberInput = this.container.querySelector(`${numberClass}[data-group="${groupIndex}"]`);
                if (numberInput) numberInput.value = value;
            });
        });

        // Number inputs
        this.container.querySelectorAll(numberClass).forEach(input => {
            input.addEventListener('change', () => {
                const groupIndex = parseInt(input.dataset.group);
                const value = parseInt(input.value) || 0;
                
                // Clamp value
                const min = isLabel ? -50 : (this.groupPixelMode.get(groupIndex) ? -2000 : -100);
                const max = isLabel ? 50 : (this.groupPixelMode.get(groupIndex) ? 2000 : 100);
                const clampedValue = Math.max(min, Math.min(max, value));
                input.value = clampedValue;
                
                if (isLabel) {
                    this.updateLabelOffset(groupIndex, isX, clampedValue);
                } else {
                    this.updateGroupOffset(groupIndex, isX, clampedValue);
                }
                
                // Update corresponding slider
                const slider = this.container.querySelector(`${sliderClass}[data-group="${groupIndex}"]`);
                if (slider) slider.value = clampedValue;
            });
        });
    }

    updateGroupOffset(groupIndex, isX, value) {
        if (!this.groupOffsets.has(groupIndex)) {
            this.groupOffsets.set(groupIndex, { x: 0, y: 0 });
        }
        
        if (isX) {
            this.groupOffsets.get(groupIndex).x = value;
        } else {
            this.groupOffsets.get(groupIndex).y = value;
        }
        
        eventBus.emit(EVENTS.GROUP_OFFSET_CHANGED, {
            groupIndex,
            offset: this.groupOffsets.get(groupIndex)
        });
    }

    updateLabelOffset(groupIndex, isX, value) {
        if (!this.groupLabelOffsets.has(groupIndex)) {
            this.groupLabelOffsets.set(groupIndex, { x: 0, y: 0 });
        }
        
        if (isX) {
            this.groupLabelOffsets.get(groupIndex).x = value;
        } else {
            this.groupLabelOffsets.get(groupIndex).y = value;
        }
        
        eventBus.emit(EVENTS.GROUP_LABEL_OFFSET_CHANGED, {
            groupIndex,
            offset: this.groupLabelOffsets.get(groupIndex)
        });
    }

    resetAll() {
        this.groupOffsets.clear();
        this.groupNames.clear();
        this.groupPixelMode.clear();
        this.groupLabelOffsets.clear();
        if (this.groupLabelBold) this.groupLabelBold.clear();
        if (this.groupLabelItalic) this.groupLabelItalic.clear();
        if (this.groupLabelUnderline) this.groupLabelUnderline.clear();
        this.update();
        eventBus.emit(EVENTS.GROUP_OFFSET_CHANGED, { reset: true });
    }

    applyChanges() {
        eventBus.emit(EVENTS.MAP_PREVIEW);
    }

    getGroupData() {
        return {
            groups: this.currentGroups,
            offsets: this.groupOffsets,
            pixelModes: this.groupPixelMode,
            names: this.groupNames,
            labelOffsets: this.groupLabelOffsets,
            labelBold: this.groupLabelBold,
            labelItalic: this.groupLabelItalic,
            labelUnderline: this.groupLabelUnderline
        };
    }

    setGroupData(data) {
        if (data.groups) this.currentGroups = data.groups;
        if (data.offsets) this.groupOffsets = new Map(data.offsets);
        if (data.pixelModes) this.groupPixelMode = new Map(data.pixelModes);
        if (data.names) this.groupNames = new Map(data.names);
        if (data.labelOffsets) this.groupLabelOffsets = new Map(data.labelOffsets);
        if (data.labelBold) this.groupLabelBold = new Map(data.labelBold);
        if (data.labelItalic) this.groupLabelItalic = new Map(data.labelItalic);
        if (data.labelUnderline) this.groupLabelUnderline = new Map(data.labelUnderline);
        this.update();
    }
}