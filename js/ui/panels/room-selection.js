// Room Selection Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class RoomSelectionPanel {
    constructor(mapdbLoader, mapdb) {
        this.mapdbLoader = mapdbLoader;
        this.mapdb = mapdb;
        this.locationSelect = null;
        this.locationGroup = null;
        this.customGroup = null;
    }

    init() {
        this.locationSelect = document.getElementById('location-select');
        this.locationGroup = document.getElementById('location-group');
        this.customGroup = document.getElementById('custom-group');
        
        this.setupEventListeners();
        this.populateLocationDropdown();
    }

    setupEventListeners() {
        // Room selection method radio buttons
        document.querySelectorAll('input[name="room-selection"]').forEach(radio => {
            radio.addEventListener('change', this.handleRoomSelectionChange.bind(this));
        });

        // Location selection change
        if (this.locationSelect) {
            this.locationSelect.addEventListener('change', () => {
                eventBus.emit(EVENTS.ROOM_SELECTION_CHANGED, {
                    method: 'location',
                    selections: Array.from(this.locationSelect.selectedOptions).map(opt => opt.value)
                });
            });
        }

        // Custom room range changes
        const roomRangesInput = document.getElementById('room-ranges');
        if (roomRangesInput) {
            roomRangesInput.addEventListener('change', () => {
                eventBus.emit(EVENTS.ROOM_SELECTION_CHANGED, {
                    method: 'custom',
                    ranges: roomRangesInput.value
                });
            });
        }
    }

    populateLocationDropdown() {
        if (!this.mapdb || !this.locationSelect) {
            console.error('Cannot populate locations - MapDB not loaded or select not found');
            return;
        }

        const locations = this.mapdbLoader.extractLocations(this.mapdb);
        
        // Clear existing options
        this.locationSelect.innerHTML = '';
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            this.locationSelect.appendChild(option);
        });

        console.log(`Populated ${locations.length} locations`);
        
        // Set a default selection for testing
        if (locations.includes("Sailor's Grief")) {
            const option = this.locationSelect.querySelector(`option[value="Sailor's Grief"]`);
            if (option) option.selected = true;
        }
    }

    handleRoomSelectionChange(e) {
        const method = e.target.value;
        console.log('Room selection changed to:', method);
        
        if (method === 'location') {
            this.locationGroup.classList.remove('hidden');
            this.customGroup.classList.add('hidden');
        } else if (method === 'custom') {
            this.locationGroup.classList.add('hidden');
            this.customGroup.classList.remove('hidden');
        }
        
        eventBus.emit(EVENTS.ROOM_SELECTION_CHANGED, { method });
    }

    getSelectionMethod() {
        return document.querySelector('input[name="room-selection"]:checked').value;
    }

    getSelectedLocations() {
        return Array.from(this.locationSelect.selectedOptions).map(opt => opt.value);
    }

    getCustomRanges() {
        return {
            ranges: document.getElementById('room-ranges').value.trim(),
            useUID: document.querySelector('input[name="room-id-type"]:checked').value === 'uid'
        };
    }

    getExclusions() {
        return {
            ranges: document.getElementById('exclude-rooms').value.trim(),
            useUID: document.querySelector('input[name="exclude-id-type"]:checked').value === 'uid'
        };
    }
}