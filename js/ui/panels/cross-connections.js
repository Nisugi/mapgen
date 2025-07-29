// Cross-Group Connections Panel UI
import { eventBus, EVENTS } from '../../utils/event-bus.js';

export class CrossConnectionsPanel {
    constructor(config) {
        this.config = config;
        this.connections = [];
        this.container = null;
    }

    init() {
        this.container = document.getElementById('cross-group-list');
        
        // Setup add button
        const addBtn = document.getElementById('add-cross-group');
        if (addBtn) {
            addBtn.addEventListener('click', this.addConnection.bind(this));
        }
        
        this.update();
    }

    addConnection() {
        const fromId = parseInt(document.getElementById('cross-from-room').value);
        const toId = parseInt(document.getElementById('cross-to-room').value);
        
        if (!fromId || !toId) {
            alert('Please enter both room IDs');
            return;
        }
        
        if (fromId === toId) {
            alert('Cannot connect a room to itself');
            return;
        }
        
        // Check if connection already exists
        if (this.connections.some(conn => 
            (conn.fromId === fromId && conn.toId === toId) ||
            (conn.fromId === toId && conn.toId === fromId)
        )) {
            alert('This connection already exists');
            return;
        }
        
        // Add connection with default settings
        const newConnection = {
            fromId: fromId,
            toId: toId,
            style: 'dashed',
            dashSpacing: '5,5',
            color: this.config.colors.connections,
            fromTerminal: {
                show: false,
                style: 'arrow'
            },
            toTerminal: {
                show: true,
                style: 'arrow'
            }
        };
        
        this.connections.push(newConnection);
        
        // Clear inputs
        document.getElementById('cross-from-room').value = '';
        document.getElementById('cross-to-room').value = '';
        
        // Update UI and emit event
        this.update();
        eventBus.emit(EVENTS.CROSS_CONNECTION_ADDED, { connection: newConnection });
    }

    update() {
        if (!this.container) return;
        
        if (this.connections.length === 0) {
            this.container.innerHTML = '<p class="empty-message">No cross-group connections defined</p>';
            return;
        }
        
        let html = '<div class="connection-list">';
        
        this.connections.forEach((conn, index) => {
            html += `
                <div class="connection-item" data-index="${index}">
                    <div class="connection-header">
                        <span>Room ${conn.fromId} → Room ${conn.toId}</span>
                        <button class="btn-small remove-connection" data-index="${index}">Remove</button>
                    </div>
                    <div class="connection-terminals">
                        <div class="terminal-row">
                            <label><input type="checkbox" class="show-from-terminal" data-index="${index}" 
                                    ${conn.fromTerminal?.show ? 'checked' : ''}> From</label>
                            <select class="from-terminal-style" data-index="${index}" style="width: 80px;">
                                <option value="arrow" ${conn.fromTerminal?.style === 'arrow' ? 'selected' : ''}>Arrow</option>
                                <option value="dot" ${conn.fromTerminal?.style === 'dot' ? 'selected' : ''}>Dot</option>
                                <option value="square" ${conn.fromTerminal?.style === 'square' ? 'selected' : ''}>Square</option>
                                <option value="diamond" ${conn.fromTerminal?.style === 'diamond' ? 'selected' : ''}>Diamond</option>
                                <option value="cross" ${conn.fromTerminal?.style === 'cross' ? 'selected' : ''}>Cross</option>
                                <option value="circle" ${conn.fromTerminal?.style === 'circle' ? 'selected' : ''}>Circle</option>
                            </select>
                            <label><input type="checkbox" class="show-to-terminal" data-index="${index}" 
                                    ${conn.toTerminal?.show ? 'checked' : ''}> To</label>
                            <select class="to-terminal-style" data-index="${index}" style="width: 80px;">
                                <option value="arrow" ${conn.toTerminal?.style === 'arrow' ? 'selected' : ''}>Arrow</option>
                                <option value="dot" ${conn.toTerminal?.style === 'dot' ? 'selected' : ''}>Dot</option>
                                <option value="square" ${conn.toTerminal?.style === 'square' ? 'selected' : ''}>Square</option>
                                <option value="diamond" ${conn.toTerminal?.style === 'diamond' ? 'selected' : ''}>Diamond</option>
                                <option value="cross" ${conn.toTerminal?.style === 'cross' ? 'selected' : ''}>Cross</option>
                                <option value="circle" ${conn.toTerminal?.style === 'circle' ? 'selected' : ''}>Circle</option>
                            </select>
                        </div>
                        <div class="connection-style">
                            Style: <select class="conn-style" data-index="${index}" style="width: 80px;">
                                <option value="dashed" ${conn.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                                <option value="dotted" ${conn.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                            </select>
                            Spacing: <input type="text" class="conn-spacing" data-index="${index}" 
                                            value="${conn.dashSpacing}" placeholder="5,5" style="width: 60px;">
                            <input type="color" class="conn-color" data-index="${index}" 
                                   value="${conn.color}" style="width: 30px; height: 25px;">
                        </div>
                    </div>                    
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Remove buttons
        this.container.querySelectorAll('.remove-connection').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const removed = this.connections[index];
                this.connections.splice(index, 1);
                this.update();
                eventBus.emit(EVENTS.CROSS_CONNECTION_REMOVED, { 
                    connection: removed, 
                    index 
                });
            });
        });

        // Style selects
        this.container.querySelectorAll('.conn-style').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                this.connections[index].style = select.value;
                
                // Update dash spacing based on style
                if (select.value === 'dotted') {
                    this.connections[index].dashSpacing = '2,3';
                } else {
                    this.connections[index].dashSpacing = '5,5';
                }
                
                this.update();
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        // Spacing inputs
        this.container.querySelectorAll('.conn-spacing').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.connections[index].dashSpacing = input.value;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        // Color inputs
        this.container.querySelectorAll('.conn-color').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                this.connections[index].color = input.value;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        // Terminal checkboxes
        this.container.querySelectorAll('.show-from-terminal').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                if (!this.connections[index].fromTerminal) {
                    this.connections[index].fromTerminal = { show: false, style: 'arrow' };
                }
                this.connections[index].fromTerminal.show = checkbox.checked;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        this.container.querySelectorAll('.show-to-terminal').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const index = parseInt(checkbox.dataset.index);
                if (!this.connections[index].toTerminal) {
                    this.connections[index].toTerminal = { show: false, style: 'arrow' };
                }
                this.connections[index].toTerminal.show = checkbox.checked;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        // From terminal style selects
        this.container.querySelectorAll('.from-terminal-style').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                if (!this.connections[index].fromTerminal) {
                    this.connections[index].fromTerminal = { show: false, style: 'arrow' };
                }
                this.connections[index].fromTerminal.style = select.value;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });

        // To terminal style selects
        this.container.querySelectorAll('.to-terminal-style').forEach(select => {
            select.addEventListener('change', () => {
                const index = parseInt(select.dataset.index);
                if (!this.connections[index].toTerminal) {
                    this.connections[index].toTerminal = { show: false, style: 'arrow' };
                }
                this.connections[index].toTerminal.style = select.value;
                eventBus.emit(EVENTS.CROSS_CONNECTION_UPDATED, {
                    connection: this.connections[index],
                    index
                });
            });
        });    
    }

    getConnections() {
        return [...this.connections];
    }

    setConnections(connections) {
        this.connections = [...connections];
        this.update();
    }
}