# Change Log

All notable changes to the "langgraph-visualizer" extension will be documented in this file.

## [0.0.1] - 2025-10-15

### Added
- Initial release of LangGraph Visualizer
- Automatic detection of LangGraph code in Python files
- Status bar icon that appears when LangGraph classes are detected
- Webview panel to display graph nodes and edges
- Support for detecting StateGraph, MessageGraph, and Graph types
- Parsing of .add_node(), .add_edge(), and .add_conditional_edges() patterns
- Support for entry points and finish points
- Real-time status bar updates as code changes

### Features
- Clean, VS Code-themed webview interface
- Display of node types (start, end, regular)
- Display of edge types (direct, conditional)
- Graph statistics (node count, edge count)
- Hover effects on nodes and edges
- Color-coded node and edge types

### Future Enhancements
- Interactive graph visualization with diagrams
- Export graph as image
- Navigate to node/edge definitions in code
- Support for more complex LangGraph patterns
- Graph validation and error detection

