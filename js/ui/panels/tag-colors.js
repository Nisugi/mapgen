// Tag Colors Panel UI - handles tag color assignments
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class TagColorsPanel {
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
        // Tag color button
        const addTagButton = document.getElementById('add-tag-color');
        if (addTagButton) {
            addTagButton.addEventListener('click', this.addTagColor.bind(this));
        }

        // Listen for room selection changes to update tags
        eventBus.on(EVENTS.ROOM_SELECTION_CHANGED, () => {
            this.populateTagDropdown();
        });
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

    emitConfigChange() {
        eventBus.emit(EVENTS.CONFIG_CHANGED, { 
            config: this.config,
            section: 'tagColors'
        });
    }

    // Get current tag colors
    getTagColors() {
        return this.config.tagColors;
    }

    // Set tag colors (for config import)
    setTagColors(tagColors) {
        if (tagColors instanceof Map) {
            this.config.tagColors = new Map(tagColors);
        } else if (Array.isArray(tagColors)) {
            this.config.tagColors = new Map(tagColors);
        } else {
            this.config.tagColors = new Map();
        }
        
        this.renderTagColorsList();
        this.emitConfigChange();
    }
}