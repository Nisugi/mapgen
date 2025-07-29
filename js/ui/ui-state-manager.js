// UI State Manager - handles UI state collection and restoration
export class UIStateManager {
    constructor(panels) {
        this.panels = panels;
    }

    // Get current UI state from all panels
    getUIState() {
        return {
            roomSelection: {
                method: this.panels.roomSelection.getSelectionMethod(),
                locations: this.panels.roomSelection.getSelectedLocations(),
                customRanges: this.panels.roomSelection.getCustomRanges(),
                exclusions: this.panels.roomSelection.getExclusions()
            },
            displayOptions: this.panels.displayOptions.getOptions(),
            groupData: this.panels.groupPositioning.getGroupData(),
            crossConnections: this.panels.crossConnections.getConnections(),
            customLabels: this.panels.customLabels.getLabels(),
            customTextBoxes: this.panels.customTextBoxes.getTextBoxes()
        };
    }

    // Restore UI state to all panels
    setUIState(state) {
        if (state.displayOptions) {
            this.panels.displayOptions.setOptions(state.displayOptions);
        }

        if (state.groupData) {
            this.panels.groupPositioning.setGroupData(state.groupData);
        }

        if (state.crossConnections) {
            this.panels.crossConnections.setConnections(state.crossConnections);
        }

        if (state.customLabels) {
            this.panels.customLabels.setLabels(state.customLabels);
        }

        if (state.customTextBoxes) {
            this.panels.customTextBoxes.setTextBoxes(state.customTextBoxes);
        }

        // Room selection would need more complex handling
        // as it involves updating form elements
        if (state.roomSelection) {
            this.setRoomSelectionState(state.roomSelection);
        }
    }

    setRoomSelectionState(roomSelection) {
        // Set selection method
        const methodRadio = document.querySelector(`input[name="room-selection"][value="${roomSelection.method}"]`);
        if (methodRadio) {
            methodRadio.checked = true;
            methodRadio.dispatchEvent(new Event('change'));
        }

        // Set locations or custom ranges based on method
        if (roomSelection.method === 'location' && roomSelection.locations) {
            const locationSelect = document.getElementById('location-select');
            if (locationSelect) {
                // Clear current selection
                Array.from(locationSelect.options).forEach(opt => opt.selected = false);
                // Select specified locations
                roomSelection.locations.forEach(location => {
                    const option = locationSelect.querySelector(`option[value="${location}"]`);
                    if (option) option.selected = true;
                });
            }
        } else if (roomSelection.method === 'custom') {
            if (roomSelection.customRanges.ranges) {
                const rangesInput = document.getElementById('room-ranges');
                if (rangesInput) rangesInput.value = roomSelection.customRanges.ranges;
            }
            if (roomSelection.customRanges.useUID) {
                const uidRadio = document.querySelector('input[name="room-id-type"][value="uid"]');
                if (uidRadio) uidRadio.checked = true;
            }
        }

        // Set exclusions
        if (roomSelection.exclusions.ranges) {
            const excludeInput = document.getElementById('exclude-rooms');
            if (excludeInput) excludeInput.value = roomSelection.exclusions.ranges;
        }
        if (roomSelection.exclusions.useUID) {
            const excludeUidRadio = document.querySelector('input[name="exclude-id-type"][value="uid"]');
            if (excludeUidRadio) excludeUidRadio.checked = true;
        }
    }
}