// Coordinate Manager - handles coordinate saving and loading operations
export class CoordinateManager {
    constructor(coordinateStorage, roomSelector, uiManager) {
        this.coordinateStorage = coordinateStorage;
        this.roomSelector = roomSelector;
        this.uiManager = uiManager;
        this.mapdbVersion = null;
    }

    setMapDBVersion(version) {
        this.mapdbVersion = version;
    }

    loadSavedCoordinates() {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const savedCoords = this.coordinateStorage.loadCoordinates(mapId, this.mapdbVersion);
        
        if (savedCoords) {
            console.log('Loading saved coordinates for', mapId);
            
            // Load data into UI panels
            const groupData = this.uiManager.panels.groupPositioning.getGroupData();
            groupData.offsets = new Map(savedCoords.groupOffsets || []);
            groupData.names = new Map(savedCoords.groupNames || []);
            groupData.labelOffsets = new Map(savedCoords.groupLabelOffsets || []);
            
            this.uiManager.panels.crossConnections.setConnections(savedCoords.crossGroupConnections || []);
            this.uiManager.panels.customLabels.setLabels(savedCoords.customLabels || []);
            this.uiManager.panels.customTextBoxes.setTextBoxes(savedCoords.customTextBoxes || []);
            
            return true;
        }

        // Check for pending group data from config import
        if (window.app.pendingGroupData) {
            console.log('Applying pending group data from config import');
            const gp = window.app.pendingGroupData;
            const groupData = this.uiManager.panels.groupPositioning.getGroupData();
           
            if (gp.offsets) {
                groupData.offsets = new Map(gp.offsets);
            }
            if (gp.names) {
                groupData.names = new Map(gp.names);
            }
            if (gp.labelOffsets) {
                groupData.labelOffsets = new Map(gp.labelOffsets);
            }
            if (gp.labelBold) {
                this.uiManager.panels.groupPositioning.groupLabelBold = new Map(gp.labelBold);
            }
           
            // Apply other pending data
            if (window.app.pendingCrossConnections) {
                this.uiManager.panels.crossConnections.setConnections(window.app.pendingCrossConnections);
            }
            if (window.app.pendingCustomLabels) {
                this.uiManager.panels.customLabels.setLabels(window.app.pendingCustomLabels);
            }
            if (window.app.pendingCustomTextBoxes) {
                this.uiManager.panels.customTextBoxes.setTextBoxes(window.app.pendingCustomTextBoxes);
            }
           
            // Clear pending data
            delete window.app.pendingGroupData;
            delete window.app.pendingCrossConnections;
            delete window.app.pendingCustomLabels;
            delete window.app.pendingCustomTextBoxes;

            // Force UI update to show the applied data
            this.uiManager.panels.groupPositioning.update();
            this.uiManager.panels.crossConnections.update();
            this.uiManager.panels.customLabels.update();
            this.uiManager.panels.customTextBoxes.update();
           
            return true;
       }
        return false;
    }

    saveCurrentCoordinates() {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const uiState = this.uiManager.getUIState();
        
        const coordData = {
            mapId: mapId,
            version: this.mapdbVersion,
            groupOffsets: Array.from(uiState.groupData.offsets.entries()),
            groupNames: Array.from(uiState.groupData.names.entries()),
            groupLabelOffsets: Array.from(uiState.groupData.labelOffsets.entries()),
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels,
            customTextBoxes: uiState.customTextBoxes,
            created: new Date().toISOString()
        };
        
        this.coordinateStorage.saveCoordinates(mapId, this.mapdbVersion, coordData);
        console.log('Saved coordinates for', mapId);
    }

    applyPendingGroupData(currentGroups) {
        if (window.app.pendingGroupData) {
            const gp = window.app.pendingGroupData;
            const groupData = this.uiManager.panels.groupPositioning.getGroupData();
            
            // Set the current groups so the UI knows about them
            groupData.groups = currentGroups;
            
            if (gp.offsets) {
                groupData.offsets = new Map(gp.offsets);
            }
            if (gp.names) {
                groupData.names = new Map(gp.names);
            }
            if (gp.labelOffsets) {
                groupData.labelOffsets = new Map(gp.labelOffsets);
            }
           
            // Clear pending data
            delete window.app.pendingGroupData;
           
            console.log('Applied pending group data after group creation');
        }
    }
}