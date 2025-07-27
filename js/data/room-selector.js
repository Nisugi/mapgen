// Room selection logic
import { eventBus, EVENTS } from '../utils/event-bus.js';

export class RoomSelector {
    constructor(mapdbLoader, mapdb) {
        this.mapdbLoader = mapdbLoader;
        this.mapdb = mapdb;
    }

    getSelectedRooms() {
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        let selectedRooms = [];
        
        if (selectionMethod === 'location') {
            selectedRooms = this.getLocationRooms();
        } else {
            selectedRooms = this.getCustomRooms();
        }
        
        // Apply exclusions
        selectedRooms = this.applyExclusions(selectedRooms);
        
        eventBus.emit(EVENTS.ROOMS_SELECTED, { rooms: selectedRooms });
        return selectedRooms;
    }

    getLocationRooms() {
        const locationSelect = document.getElementById('location-select');
        const selectedOptions = Array.from(locationSelect.selectedOptions);
        
        if (selectedOptions.length === 0) {
            throw new Error('Please select at least one location');
        }
        
        let selectedRooms = [];
        
        // Get rooms from all selected locations
        selectedOptions.forEach(option => {
            const locationRooms = this.mapdbLoader.getRoomsByLocation(this.mapdb, option.value);
            selectedRooms = selectedRooms.concat(locationRooms);
        });
        
        // Remove duplicates
        const roomIds = new Set();
        selectedRooms = selectedRooms.filter(room => {
            if (roomIds.has(room.id)) {
                return false;
            }
            roomIds.add(room.id);
            return true;
        });
        
        return selectedRooms;
    }

    getCustomRooms() {
        const rangeText = document.getElementById('room-ranges').value.trim();
        if (!rangeText) {
            throw new Error('Please enter room ranges');
        }
        
        const useUID = document.querySelector('input[name="room-id-type"]:checked').value === 'uid';
        const roomIds = this.mapdbLoader.parseRoomRanges(rangeText);
        
        let selectedRooms;
        
        if (useUID) {
            // Filter by UID
            selectedRooms = this.mapdb.filter(room => {
                if (room.uid && Array.isArray(room.uid)) {
                    return roomIds.some(id => room.uid.includes(id));
                }
                return false;
            });
        } else {
            // Filter by ID (default)
            selectedRooms = this.mapdb.filter(room => roomIds.includes(room.id));
        }
        
        return selectedRooms;
    }

    applyExclusions(rooms) {
        const excludeText = document.getElementById('exclude-rooms').value.trim();
        if (!excludeText) return rooms;
        
        const useExcludeUID = document.querySelector('input[name="exclude-id-type"]:checked').value === 'uid';
        const excludeIds = this.mapdbLoader.parseRoomRanges(excludeText);
        
        if (useExcludeUID) {
            // Exclude by UID
            return rooms.filter(room => {
                if (room.uid && Array.isArray(room.uid)) {
                    return !excludeIds.some(id => room.uid.includes(id));
                }
                return true; // Keep rooms without UIDs
            });
        } else {
            // Exclude by ID (default)
            return rooms.filter(room => !excludeIds.includes(room.id));
        }
    }

    getCurrentMapIdentifier() {
        const selectionMethod = document.querySelector('input[name="room-selection"]:checked').value;
        
        if (selectionMethod === 'location') {
            const locationSelect = document.getElementById('location-select');
            const selectedOptions = Array.from(locationSelect.selectedOptions);
            const locations = selectedOptions.map(opt => opt.value).sort().join(',');
            
            // Include exclusions in identifier if present
            const excludeText = document.getElementById('exclude-rooms').value.trim();
            const excludeSuffix = excludeText ? `_exclude_${excludeText.replace(/[^0-9,-]/g, '')}` : '';
            
            return `location_${locations}${excludeSuffix}`;
        } else {
            const rangeText = document.getElementById('room-ranges').value.trim();
            const useUID = document.querySelector('input[name="room-id-type"]:checked').value === 'uid';
            
            // Include exclusions in identifier if present
            const excludeText = document.getElementById('exclude-rooms').value.trim();
            const excludeSuffix = excludeText ? `_exclude_${excludeText.replace(/[^0-9,-]/g, '')}` : '';
            
            return `${useUID ? 'uid' : 'id'}_${rangeText}${excludeSuffix}`;
        }
    }
}