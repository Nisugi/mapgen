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

        // Ensure tagColors is converted to array format for JSON
        let tagColorsArray = [];
        if (config.tagColors instanceof Map) {
            tagColorsArray = Array.from(config.tagColors.entries());
        } else if (Array.isArray(config.tagColors)) {
            tagColorsArray = config.tagColors;
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
                theme: config.theme || 'custom',
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
                tagColors: tagColorsArray
            },
            displayOptions: {
                showRoomIds: uiState.displayOptions.showRoomIds,
                showRoomNames: uiState.displayOptions.showRoomNames,
                showLabels: uiState.displayOptions.showLabels,
                showConnections: uiState.displayOptions.showConnections,
                showGroupLabels: uiState.displayOptions.showGroupLabels
            },
            fonts: {
                labels: {
                    size: config.fonts.labels.size,
                    color: config.fonts.labels.color,
                    family: config.fonts.labels.family,
                    bold: config.fonts.labels.bold
                },
                rooms: {
                    size: config.fonts.rooms.size,
                    color: config.fonts.rooms.color,
                    family: config.fonts.rooms.family,
                    bold: config.fonts.rooms.bold
                }
            },
            backgroundSettings: {
                useBackground: config.useBackground,
                backgroundImage: config.backgroundImage
            },
            groupPositioning: {
                offsets: Array.from(uiState.groupData.offsets.entries()),
                names: Array.from(uiState.groupData.names.entries()),
                labelOffsets: Array.from(uiState.groupData.labelOffsets.entries()),
                labelBold: Array.from(uiState.groupData.labelBold?.entries() || [])
            },
            crossGroupConnections: uiState.crossConnections.map(conn => ({
                fromId: conn.fromId,
                toId: conn.toId,
                style: conn.style,
                dashSpacing: conn.dashSpacing,
                color: conn.color,
                showFromTerminal: conn.showFromTerminal,
                showToTerminal: conn.showToTerminal,
                terminalStyle: conn.terminalStyle
            })),
            customLabels: uiState.customLabels.map(label => ({
                text: label.text,
                x: label.x,
                y: label.y,
                fontSize: label.fontSize,
                fontColor: label.fontColor,
                fontFamily: label.fontFamily,
                bold: label.bold,
                rotation: label.rotation || 0,
                background: label.background,
                backgroundColor: label.backgroundColor,
                borderColor: label.borderColor,
                borderWidth: label.borderWidth
            })),
            customTextBoxes: uiState.customTextBoxes?.map(box => ({
                id: box.id,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                padding: box.padding,
                content: box.content,
                backgroundColor: box.backgroundColor,
                borderColor: box.borderColor,
                borderWidth: box.borderWidth,
                borderStyle: box.borderStyle,
                borderRadius: box.borderRadius,
                opacity: box.opacity,
                rotation: box.rotation,
                textAlign: box.textAlign,
                verticalAlign: box.verticalAlign
            })) || []
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
            
            // Apply theme
            if (app.theme) {
                appConfig.theme = app.theme;
                const themeSelect = document.getElementById('theme-preset');
                if (themeSelect) themeSelect.value = app.theme;
            }
            
            // Apply sliders
            Object.entries(app).forEach(([key, value]) => {
                if (appConfig[key] !== undefined) {
                    appConfig[key] = value;
                    
                    // Update UI elements
                    const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
                    if (element) {
                        element.value = value;
                        // Update display value
                        const valueDisplay = document.getElementById(element.id + '-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = value + (element.type === 'range' ? 'px' : '');
                        }
                    }
                }
            });
        }
        
        // Apply colors
        if (parsedConfig.colors) {
            if (parsedConfig.colors.tagColors) {
                // Ensure tagColors is a Map
                appConfig.tagColors = new Map(parsedConfig.colors.tagColors);
                // Update UI
                if (uiManager.panels.themeColors) {
                    uiManager.panels.themeColors.renderTagColorsList();
                }
            }
            
            // Apply color inputs
            Object.entries(parsedConfig.colors).forEach(([key, value]) => {
                if (key !== 'tagColors' && appConfig.colors[key] !== undefined) {
                    appConfig.colors[key] = value;
                    
                    // Update color input
                    const colorKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    const colorInput = document.getElementById(colorKey + '-color');
                    if (colorInput) colorInput.value = value;
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
            const checkbox = document.getElementById('use-background');
            if (checkbox) checkbox.checked = appConfig.useBackground;
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
            if (gp.labelBold) {
                uiManager.panels.groupPositioning.groupLabelBold = new Map(gp.labelBold);
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
        
        // Apply custom text boxes
        if (parsedConfig.customTextBoxes) {
            uiManager.panels.customTextBoxes.setTextBoxes(parsedConfig.customTextBoxes);
        }
    }
}