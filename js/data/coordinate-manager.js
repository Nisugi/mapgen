// Coordinate Manager - handles coordinate saving and loading operations
export class CoordinateManager {
    constructor(coordinateStorage, roomSelector, panelManager) {
        this.coordinateStorage = coordinateStorage;
        this.roomSelector = roomSelector;
        this.panelManager = panelManager;
        this.mapdbVersion = null;
    }

    setMapDBVersion(version) {
        this.mapdbVersion = version;
    }

    loadSavedCoordinates() {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const savedCoords = this.coordinateStorage.loadCoordinates(mapId, this.mapdbVersion);
        this.savedAnchorEdits = null;

        if (savedCoords) {
            console.log('Loading saved coordinates for', mapId);

            // Anchor-keyed edits survive mapdb/solver changes; the generator
            // translates them to current group indices after positioning.
            this.savedAnchorEdits = {
                offsets: savedCoords.anchorOffsets || [],
                pixelModes: savedCoords.anchorPixelModes || [],
                names: savedCoords.anchorNames || [],
                labelOffsets: savedCoords.anchorLabelOffsets || []
            };

            // Load data into UI panels
            const groupData = this.panelManager.panels.groupPositioning.getGroupData();
            groupData.offsets = new Map(savedCoords.groupOffsets || []);
            groupData.pixelModes = new Map(savedCoords.groupPixelModes || []);
            groupData.names = new Map(savedCoords.groupNames || []);
            groupData.labelOffsets = new Map(savedCoords.groupLabelOffsets || []);

            this.panelManager.panels.crossConnections.setConnections(savedCoords.crossGroupConnections || []);
            this.panelManager.panels.customLabels.setLabels(savedCoords.customLabels || []);
            this.panelManager.panels.customTextBoxes.setTextBoxes(savedCoords.customTextBoxes || []);

            return true;
        }

        // Check for pending group data from config import
        if (window.app.pendingGroupData) {
            console.log('Applying pending group data from config import');
            const gp = window.app.pendingGroupData;
            const groupData = this.panelManager.panels.groupPositioning.getGroupData();
           
            if (gp.offsets) {
                groupData.offsets = new Map(gp.offsets);
            }
            if (gp.pixelModes) {
                this.panelManager.panels.groupPositioning.groupPixelMode = new Map(gp.pixelModes);
            }
            if (gp.names) {
                groupData.names = new Map(gp.names);
            }
            if (gp.labelOffsets) {
                groupData.labelOffsets = new Map(gp.labelOffsets);
            }
            if (gp.labelBold) {
                this.panelManager.panels.groupPositioning.groupLabelBold = new Map(gp.labelBold);
            }
           
            // Apply other pending data
            if (window.app.pendingCrossConnections) {
                this.panelManager.panels.crossConnections.setConnections(window.app.pendingCrossConnections);
            }
            if (window.app.pendingCustomLabels) {
                this.panelManager.panels.customLabels.setLabels(window.app.pendingCustomLabels);
            }
            if (window.app.pendingCustomTextBoxes) {
                this.panelManager.panels.customTextBoxes.setTextBoxes(window.app.pendingCustomTextBoxes);
            }
           
            // Clear pending data
            delete window.app.pendingGroupData;
            delete window.app.pendingCrossConnections;
            delete window.app.pendingCustomLabels;
            delete window.app.pendingCustomTextBoxes;

            // Force UI update to show the applied data
            this.panelManager.panels.groupPositioning.update();
            this.panelManager.panels.crossConnections.update();
            this.panelManager.panels.customLabels.update();
            this.panelManager.panels.customTextBoxes.update();
           
            return true;
       }
        return false;
    }

    saveCurrentCoordinates(currentGroups = null) {
        const mapId = this.roomSelector.getCurrentMapIdentifier();
        const uiState = this.panelManager.getUIState();

        // Re-key index-based edits by each group's stable anchor room id so
        // they survive group reordering, mapdb updates, and solver changes.
        const anchorByIndex = new Map((currentGroups ?? []).map(g => [g.index, g.anchorId]));
        const toAnchor = (indexEntries) => {
            const out = [];
            for (const [index, value] of indexEntries) {
                const anchorId = anchorByIndex.get(index);
                if (anchorId !== undefined) out.push([anchorId, value]);
            }
            return out;
        };

        const coordData = {
            mapId: mapId,
            version: this.mapdbVersion,
            groupOffsets: Array.from(uiState.groupData.offsets.entries()),
            groupPixelModes: Array.from(uiState.groupData.pixelModes.entries()),
            groupNames: Array.from(uiState.groupData.names.entries()),
            groupLabelOffsets: Array.from(uiState.groupData.labelOffsets.entries()),
            anchorOffsets: toAnchor(uiState.groupData.offsets.entries()),
            anchorPixelModes: toAnchor(uiState.groupData.pixelModes.entries()),
            anchorNames: toAnchor(uiState.groupData.names.entries()),
            anchorLabelOffsets: toAnchor(uiState.groupData.labelOffsets.entries()),
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
            const groupData = this.panelManager.panels.groupPositioning.getGroupData();
            
            // Set the current groups so the UI knows about them
            groupData.groups = currentGroups;
            
            if (gp.offsets) {
                groupData.offsets = new Map(gp.offsets);
            }
            if (gp.pixelModes) {
                groupData.pixelModes = new Map(gp.pixelModes);
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