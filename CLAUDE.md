# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elanthian Map Generator is a web-based tool for generating custom maps from the Elanthia MapDB. It's a pure JavaScript ES6 module application with no build process, served directly via GitHub Pages at https://nisugi.github.io/mapgen/.

## Key Architecture

### Module Structure
The application uses native ES6 modules organized into distinct functional areas:

- **app-core.js**: Main application entry point that initializes all subsystems
- **map-generator.js**: Core map generation logic that coordinates positioning, grouping, and SVG rendering
- **generation/** modules: Room positioning, SVG rendering, connection analysis, group management
- **ui/** modules: Panel management, UI state, and individual panel controllers
- **github/** modules: GitHub integration for saving/loading map configurations
- **data/** modules: Coordinate management and room selection from MapDB

### Data Flow
1. MapDB (45MB JSON) → loaded and parsed by mapdb-loader.js
2. Room selection → filtered based on location or custom ID ranges
3. Position calculation → rooms positioned using connection analysis
4. Group management → rooms grouped by connectivity, with support for pixel-mode positioning
5. SVG generation → final map rendered with configurable appearance options
6. Export options → SVG files, coordinate JSON, or full configuration

### Group Positioning System
Groups can be positioned in two modes:
- **Grid mode** (default): Offsets measured in grid cells
- **Pixel mode**: Fine-grained positioning for special groups (configured via `pixelMode` flag)

The positioning pipeline:
```javascript
// Grid mode: offset.x/y = cells
cellOffset = group.offset.x * CELL_SIZE

// Pixel mode: offset.x/y = pixels
pixelOffset = group.pixelMode ? group.offset.x : group.offset.x * CELL_SIZE
```

## Development Commands

### Local Development
```bash
# Serve the application locally (requires a local web server due to CORS)
python -m http.server 8000
# or
npx http-server -p 8000

# Then open: http://localhost:8000
```

### Testing
No automated test suite currently exists. Testing is manual through the web interface.

### Linting
No linting configuration currently exists. Consider using ESLint for JavaScript code quality.

## Working with the Codebase

### Adding New Features
1. Follow existing ES6 module patterns - each module exports a class
2. Use the event bus (utils/event-bus.js) for cross-module communication
3. UI panels should extend patterns in ui/panels/
4. Maintain separation between data processing (generation/) and UI (ui/)

### Modifying Map Generation
- Core logic is in map-generator.js and generation/ modules
- Room positioning: generation/room-positioner.js
- SVG rendering: generation/svg-renderer.js
- Connection analysis: generation/connection-analyzer.js
- Group offsets: generation/group-manager.js

### GitHub Integration
The app uses GitHub API to save/load map configurations:
- Authentication via personal access token
- Maps stored as JSON in user's GitHub account
- Repository: configured in github/storage/map-repository.js

### Coordinate System
- Rooms have base positions from MapDB (row/col)
- Groups apply offsets for layout
- Final positions calculated as: `(col + offset.x) × CELL_SIZE`
- Image coordinates baked into export for client consumption

## Important Files

- **mapdb.json**: Source data containing all room and connection information
- **index.html**: Single-page application entry point with tab-based UI
- **css/style.css**: Main stylesheet that imports modular CSS files
- **js/config/default-config.js**: Default configuration values
- **maps/**: Stored map configurations organized by location