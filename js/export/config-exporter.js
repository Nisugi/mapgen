// Config Exporter - handles configuration exports
export class ConfigExporter {
    constructor(mapdbVersion) {
        this.mapdbVersion = mapdbVersion;
    }

    generateConfig(mapName, uiState, config, author = 'unknown', description = '') {
        const roomSelection = uiState.roomSelection;
        
        let roomSelectionConfig = {
            method: roomSelection.method
        };
        
        if (roomSelection.method === 'location') {
            roomSelectionConfig.locations = roomSelection.locations;
        } else {
            roomSelectionConfig.ranges = roomSelection.customRanges.ranges;
            roomSelectionConfig.useUID = roomSelection.customRanges.useUID;
        }
        
        // Add exclusions if present
        if (roomSelection.exclusions.ranges) {
            roomSelectionConfig.exclusions = roomSelection.exclusions.ranges;
            roomSelectionConfig.excludeUseUID = roomSelection.exclusions.useUID;
        }

        const exportConfig = {
            metadata: {
                name: mapName,
                description: description,
                author: author,
                created: new Date().toISOString(),
                mapdbVersion: this.mapdbVersion,
                appVersion: '1.0.0'
            },
            roomSelection: roomSelectionConfig,
            appearance: {
                edgeLength: config.edgeLength,
                roomShape: config.roomShape,
                roomSize: config.roomSize,
                strokeWidth: config.strokeWidth,
                connectionWidth: config.connectionWidth
            },
            colors: {
                default: config.colors.default,
                background: config.colors.background,
                connections: config.colors.connections,
                verticalConnections: config.colors.verticalConnections,
                tagColors: Array.from(config.tagColors.entries())
            },
            displayOptions: uiState.displayOptions,
            fonts: {
                labels: { ...config.fonts.labels },
                rooms: { ...config.fonts.rooms }
            },
            backgroundSettings: {
                useBackground: config.useBackground,
                backgroundImage: config.backgroundImage
            },
            groupPositioning: {
                offsets: Array.from(uiState.groupData.offsets.entries()),
                names: Array.from(uiState.groupData.names.entries()),
                labelOffsets: Array.from(uiState.groupData.labelOffsets.entries())
            },
            crossGroupConnections: uiState.crossConnections,
            customLabels: uiState.customLabels
        };

        return JSON.stringify(exportConfig, null, 2);
    }

    downloadConfig(config, filename) {
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    parseConfig(configString) {
        try {
            const config = JSON.parse(configString);
            
            // Validate structure
            if (!config.metadata || !config.roomSelection) {
                throw new Error('Invalid configuration format');
            }
            
            return config;
        } catch (error) {
            throw new Error('Failed to parse configuration: ' + error.message);
        }
    }

    applyConfig(parsedConfig, uiManager, appConfig) {
        // Apply room selection
        if (parsedConfig.roomSelection) {
            const rs = parsedConfig.roomSelection;
            
            // Set selection method
            const methodRadio = document.querySelector(`input[name="room-selection"][value="${rs.method}"]`);
            if (methodRadio) {
                methodRadio.checked = true;
                methodRadio.dispatchEvent(new Event('change'));
            }
            
            if (rs.method === 'location' && rs.locations) {
                const locationSelect = document.getElementById('location-select');
                if (locationSelect) {
                    // Clear selection
                    Array.from(locationSelect.options).forEach(opt => opt.selected = false);
                    // Select specified locations
                    rs.locations.forEach(location => {
                        const option = locationSelect.querySelector(`option[value="${location}"]`);
                        if (option) option.selected = true;
                    });
                }
            } else if (rs.method === 'custom') {
                if (rs.ranges) {
                    document.getElementById('room-ranges').value = rs.ranges;
                }
                if (rs.useUID) {
                    document.querySelector('input[name="room-id-type"][value="uid"]').checked = true;
                }
            }
            
            // Apply exclusions
            if (rs.exclusions) {
                document.getElementById('exclude-rooms').value = rs.exclusions;
                if (rs.excludeUseUID) {
                    document.querySelector('input[name="exclude-id-type"][value="uid"]').checked = true;
                }
            }
        }
        
        // Apply appearance settings
        if (parsedConfig.appearance) {
            const app = parsedConfig.appearance;
            Object.entries(app).forEach(([key, value]) => {
                if (appConfig[key] !== undefined) {
                    appConfig[key] = value;
                }
            });
        }
        
        // Apply colors
        if (parsedConfig.colors) {
            if (parsedConfig.colors.tagColors) {
                appConfig.tagColors = new Map(parsedConfig.colors.tagColors);
            }
            Object.entries(parsedConfig.colors).forEach(([key, value]) => {
                if (key !== 'tagColors' && appConfig.colors[key] !== undefined) {
                    appConfig.colors[key] = value;
                }
            });
        }
        
        // Apply display options
        if (parsedConfig.displayOptions) {
            uiManager.panels.displayOptions.setOptions(parsedConfig.displayOptions);
        }
        
        // Apply fonts
        if (parsedConfig.fonts) {
            uiManager.panels.fontSettings.setFontSettings(parsedConfig.fonts);
        }
        
        // Apply background settings
        if (parsedConfig.backgroundSettings) {
            appConfig.useBackground = parsedConfig.backgroundSettings.useBackground;
            appConfig.backgroundImage = parsedConfig.backgroundSettings.backgroundImage;
            document.getElementById('use-background').checked = appConfig.useBackground;
        }
        
        // Apply group positioning
        if (parsedConfig.groupPositioning) {
            const gp = parsedConfig.groupPositioning;
            const groupData = uiManager.panels.groupPositioning.getGroupData();
            
            if (gp.offsets) {
                groupData.offsets = new Map(gp.offsets);
            }
            if (gp.names) {
                groupData.names = new Map(gp.names);
            }
            if (gp.labelOffsets) {
                groupData.labelOffsets = new Map(gp.labelOffsets);
            }
        }
        
        // Apply cross-group connections
        if (parsedConfig.crossGroupConnections) {
            uiManager.panels.crossConnections.setConnections(parsedConfig.crossGroupConnections);
        }
        
        // Apply custom labels
        if (parsedConfig.customLabels) {
            uiManager.panels.customLabels.setLabels(parsedConfig.customLabels);
        }
    }
}