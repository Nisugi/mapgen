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
            color: this.config.colors.connections
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
                    <div class="connection-controls">
                        <div class="control-group">
                            <label>Style:</label>
                            <select class="conn-style" data-index="${index}">
                                <option value="dashed" ${conn.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                                <option value="dotted" ${conn.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Spacing:</label>
                            <input type="text" class="conn-spacing" data-index="${index}" 
                                   value="${conn.dashSpacing}" placeholder="5,5">
                        </div>
                        <div class="control-group">
                            <label>Color:</label>
                            <input type="color" class="conn-color" data-index="${index}" 
                                   value="${conn.color}">
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
    }

    getConnections() {
        return [...this.connections];
    }

    setConnections(connections) {
        this.connections = [...connections];
        this.update();
    }
}