# Change Log

All notable changes to the "langgraph-visualizer" extension will be documented in this file.

## [0.2.0] - 2025-11-23

### 🎨 Visual Improvements
- **New Professional Logo**: Redesigned extension icon with modern, polished look
- **Enhanced README**: Complete redesign with banner, badges, and better organization
- **Visual Documentation**: Added feature tables, examples, and better formatting

### 📚 Documentation
- **Interactive README**: Added comprehensive feature showcase with visual elements
- **Better Examples**: Expanded code examples for simple, conditional, and multi-agent graphs
- **Quick Start Guide**: Improved onboarding experience for new users
- **Usage Tables**: Clear, structured information about interactions and features
- **Contributing Guide**: Enhanced contribution workflow documentation

### 🛠️ Developer Tools
- **Icon Generation Scripts**: Added scripts for generating PNG icons from SVG
- **Screenshot Directory**: Organized structure for demo images and GIFs
- **Build Tools**: Improved build and package scripts

### 🌟 Highlights
- More accessible and beginner-friendly documentation
- Professional branding and visual identity
- Clear feature breakdown with examples
- Better project organization

## [0.1.0] - 2025-10-15

### Added - Interactive Visualization! 🎉
- **Interactive Graph**: Fully interactive graph visualization using Cytoscape.js
- **Drag & Drop**: Drag nodes to reposition them
- **Zoom & Pan**: Mouse wheel zoom and click-drag panning
- **Auto-Layout**: Hierarchical Dagre layout algorithm
- **Search & Filter**: Real-time search with node highlighting
- **Jump to Code**: Click nodes to navigate to their definition in code
- **Node Details**: Click nodes to see function names, line numbers, and type
- **Export PNG**: Download high-resolution graph images
- **Smooth Animations**: All interactions are smoothly animated
- **Zoom Controls**: Dedicated zoom in/out/center buttons
- **Keyboard Shortcuts**: Cmd+F for search, Esc to clear
- **Legend**: Always-visible legend showing node and edge types
- **Statistics Dashboard**: Real-time node and edge counts
- **Hover Effects**: Visual feedback on node hover
- **Function Extraction**: Automatically extracts function names from add_node() calls
- **Line Numbers**: Tracks line numbers for jump-to-code functionality

### Enhanced
- Improved node parsing to extract function names
- Better edge detection for conditional routing
- Enhanced visual design with VS Code theme integration
- Responsive layout that adapts to window size
- Performance optimized for graphs with 100+ nodes

### Technical
- Integrated Cytoscape.js for graph rendering
- Added Dagre layout algorithm
- WebView messaging for jump-to-code feature
- Enhanced TypeScript interfaces for node data
- Improved error handling

## [0.0.1] - 2025-10-15

### Added
- Initial release of LangGraph Visualizer
- Automatic detection of LangGraph code in Python files
- Status bar icon that appears when LangGraph classes are detected
- Basic webview panel to display graph nodes and edges
- Support for detecting StateGraph, MessageGraph, and Graph types
- Parsing of .add_node(), .add_edge(), and .add_conditional_edges() patterns
- Support for entry points and finish points
- Real-time status bar updates as code changes

### Features
- Clean, VS Code-themed webview interface
- Display of node types (start, end, regular)
- Display of edge types (direct, conditional)
- Graph statistics (node count, edge count)
- Color-coded node and edge types

