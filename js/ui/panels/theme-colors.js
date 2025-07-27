// Theme & Colors Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';
import { THEME_PRESETS } from '../../config/theme-presets.js';

export class ThemeColorsPanel {
    constructor(config, mapdbLoader, mapdb) {
        this.config = config;
        this.mapdbLoader = mapdbLoader;
        this.mapdb = mapdb;
        this.tagSelect = null;
        this.tagColorsList = null;
        
        // Ensure tagColors is always a Map
        if (!this.config.tagColors || !(this.config.tagColors instanceof Map)) {
            this.config.tagColors = new Map();
        }
    }

    init() {
        this.tagSelect = document.getElementById('tag-select');
        this.tagColorsList = document.getElementById('tag-colors-list');
        
        this.setupEventListeners();
        this.populateTagDropdown();
        this.renderTagColorsList();
    }

    setupEventListeners() {
        // Edge length slider
        this.setupSlider('edge-length', 'edge-length-value', 'px', (value) => {
            this.config.edgeLength = parseInt(value);
            this.emitConfigChange();
        });

        // Room size slider
        this.setupSlider('room-size', 'room-size-value', 'px', (value) => {
            this.config.roomSize = parseInt(value);
            this.emitConfigChange();
        });

        // Stroke width slider
        this.setupSlider('stroke-width', 'stroke-width-value', 'px', (value) => {
            this.config.strokeWidth = parseInt(value);
            this.emitConfigChange();
        });

        // Connection width slider
        this.setupSlider('connection-width', 'connection-width-value', 'px', (value) => {
            this.config.connectionWidth = parseInt(value);
            this.emitConfigChange();
        });

        // Room shape select
        const roomShapeSelect = document.getElementById('room-shape');
        if (roomShapeSelect) {
            roomShapeSelect.addEventListener('change', (e) => {
                this.config.roomShape = e.target.value;
                this.emitConfigChange();
            });
        }

        // Color inputs
        this.setupColorInput('default-color', (value) => {
            this.config.colors.default = value;
            this.emitConfigChange();
        });

        this.setupColorInput('background-color', (value) => {
            this.config.colors.background = value;
            this.emitConfigChange();
        });

        this.setupColorInput('connection-color', (value) => {
            this.config.colors.connections = value;
            this.emitConfigChange();
        });

        this.setupColorInput('vertical-connection-color', (value) => {
            this.config.colors.verticalConnections = value;
            this.emitConfigChange();
        });

        // Tag color button
        const addTagButton = document.getElementById('add-tag-color');
        if (addTagButton) {
            addTagButton.addEventListener('click', this.addTagColor.bind(this));
        }

        // Theme preset
        const themePreset = document.getElementById('theme-preset');
        if (themePreset) {
            themePreset.addEventListener('change', this.applyThemePreset.bind(this));
        }

        // Background options
        this.setupBackgroundControls();

        // Listen for room selection changes to update tags
        eventBus.on(EVENTS.ROOM_SELECTION_CHANGED, () => {
            this.populateTagDropdown();
        });
    }

    setupSlider(sliderId, valueId, unit, onChange) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        if (slider && valueSpan) {
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value + unit;
                onChange(e.target.value);
            });
        }
    }

    setupColorInput(inputId, onChange) {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', (e) => onChange(e.target.value));
        }
    }

    setupBackgroundControls() {
        const backgroundImageInput = document.getElementById('background-image');
        if (backgroundImageInput) {
            backgroundImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.config.backgroundImage = event.target.result;
                        this.emitConfigChange();
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const clearBackgroundBtn = document.getElementById('clear-background');
        if (clearBackgroundBtn) {
            clearBackgroundBtn.addEventListener('click', () => {
                this.config.backgroundImage = null;
                if (backgroundImageInput) backgroundImageInput.value = '';
                this.emitConfigChange();
            });
        }

        const useBackgroundCheckbox = document.getElementById('use-background');
        if (useBackgroundCheckbox) {
            useBackgroundCheckbox.addEventListener('change', (e) => {
                this.config.useBackground = e.target.checked;
                this.emitConfigChange();
            });
        }
    }

    populateTagDropdown() {
        if (!this.mapdb || !this.tagSelect) return;

        try {
            // Try to get selected rooms
            const roomSelector = window.app?.roomSelector;
            const rooms = roomSelector ? roomSelector.getSelectedRooms() : [];
            
            // Extract tags only from selected rooms
            const selectedTags = new Set();
            rooms.forEach(room => {
                if (room.tags && Array.isArray(room.tags)) {
                    room.tags.forEach(tag => selectedTags.add(tag));
                }
            });
            
            const sortedTags = Array.from(selectedTags).sort();
            
            this.tagSelect.innerHTML = '<option value="">Select a tag...</option>';
            
            sortedTags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                this.tagSelect.appendChild(option);
            });

            console.log(`Populated ${sortedTags.length} tags from selected rooms`);
            
        } catch (error) {
            // If we can't get selected rooms yet, show all tags
            const allTags = this.mapdbLoader.extractTags(this.mapdb);
            
            this.tagSelect.innerHTML = '<option value="">Select a tag...</option>';
            
            allTags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                this.tagSelect.appendChild(option);
            });

            console.log(`Populated ${allTags.length} tags (fallback to all)`);
        }
    }

    addTagColor() {
        const selectedTag = this.tagSelect.value;
        
        if (!selectedTag) {
            alert('Please select a tag first');
            return;
        }

        // Ensure tagColors is a Map
        if (!this.config.tagColors || !(this.config.tagColors instanceof Map)) {
            this.config.tagColors = new Map();
        }

        if (this.config.tagColors.has(selectedTag)) {
            alert('This tag already has a color assigned');
            return;
        }

        // Add to config
        this.config.tagColors.set(selectedTag, '#ff0000'); // Default to red
        
        // Update UI
        this.renderTagColorsList();
        
        // Reset dropdown
        this.tagSelect.value = '';
        
        this.emitConfigChange();
    }

    renderTagColorsList() {
        if (!this.tagColorsList) return;
        
        // Ensure tagColors is a Map
        if (!this.config.tagColors || !(this.config.tagColors instanceof Map)) {
            this.config.tagColors = new Map();
        }
        
        if (this.config.tagColors.size === 0) {
            this.tagColorsList.innerHTML = '<div class="empty-tag-list">No tag colors defined. Select a tag above to add one.</div>';
            return;
        }
        
        let html = '';
        for (const [tag, color] of this.config.tagColors.entries()) {
            html += `
                <div class="tag-color-item" data-tag="${tag}">
                    <span class="tag-name">${tag}</span>
                    <input type="color" value="${color}" data-tag="${tag}">
                    <button class="remove-tag" data-tag="${tag}">Remove</button>
                </div>
            `;
        }
        
        this.tagColorsList.innerHTML = html;
        
        // Add event listeners
        this.tagColorsList.querySelectorAll('input[type="color"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const tag = e.target.dataset.tag;
                this.config.tagColors.set(tag, e.target.value);
                this.emitConfigChange();
            });
        });
        
        this.tagColorsList.querySelectorAll('.remove-tag').forEach(button => {
            button.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.config.tagColors.delete(tag);
                this.renderTagColorsList();
                this.emitConfigChange();
            });
        });
    }

    applyThemePreset(e) {
        const theme = THEME_PRESETS[e.target.value];
        if (theme) {
            // Update basic colors
            document.getElementById('default-color').value = theme.default;
            document.getElementById('background-color').value = theme.background;
            document.getElementById('connection-color').value = theme.connections;
            document.getElementById('vertical-connection-color').value = theme.verticalConnections;
            
            // Apply colors to config
            this.config.colors = { 
                default: theme.default,
                background: theme.background,
                connections: theme.connections,
                verticalConnections: theme.verticalConnections
            };
            
            // Ensure theme.tagColors is a Map
            if (theme.tagColors instanceof Map) {
                this.config.tagColors = new Map(theme.tagColors);
            } else {
                this.config.tagColors = new Map();
            }
            
            this.renderTagColorsList();
            this.emitConfigChange();
            
            eventBus.emit(EVENTS.THEME_CHANGED, { theme: e.target.value });
        }
    }

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { config: this.config });
    }
}