# LangGraph Visualizer

A Visual Studio Code extension that helps you visualize LangGraph graphs directly in your editor.

## Features

- **Automatic Detection**: Automatically detects LangGraph code in Python files
- **Status Bar Integration**: Shows a convenient status bar icon when LangGraph code is detected
- **Interactive Graph Visualization**: Beautiful, interactive graph with draggable nodes powered by Cytoscape.js
- **Real-time Updates**: Status bar updates as you edit your code
- **Jump to Code**: Click any node and jump directly to its definition
- **Search & Filter**: Find nodes instantly with the search bar
- **Zoom & Pan**: Navigate large graphs with smooth controls
- **Export**: Save your graph as PNG for documentation

## Usage

1. Open a Python file containing LangGraph code
2. When LangGraph classes (StateGraph, MessageGraph, etc.) are detected, a status bar item will appear
3. Click the "$(graph) LangGraph" icon in the status bar to visualize the graph
4. Interact with the visualization:
   - **Drag nodes** to reposition them
   - **Zoom** with mouse wheel or buttons
   - **Click nodes** to see details and jump to code
   - **Search** for specific nodes
   - **Export** as PNG for documentation

## Supported LangGraph Patterns

The extension detects and parses the following patterns:

- **Graph Types**: `StateGraph`, `MessageGraph`, `Graph`
- **Nodes**: `.add_node("node_name", function)`
- **Edges**: `.add_edge("from", "to")`
- **Conditional Edges**: `.add_conditional_edges("from", function, {...})`
- **Entry Points**: `.set_entry_point("node")`
- **Finish Points**: `.set_finish_point("node")`

## Example

```python
from langgraph.graph import StateGraph

# Create a graph
graph = StateGraph()

# Add nodes
graph.add_node("start", start_function)
graph.add_node("process", process_function)
graph.add_node("end", end_function)

# Add edges
graph.add_edge("start", "process")
graph.add_edge("process", "end")

# Compile the graph
compiled_graph = graph.compile()
```

When you open this file, click the LangGraph icon in the status bar to see:
- **Interactive Graph**: Nodes arranged in a hierarchical layout
- **Node Details**: Click nodes to see function names and line numbers
- **Color Coding**: Green (start) → Blue (process) → Red (end)
- **Jump to Code**: Click any node and navigate to its definition instantly

## Requirements

- Visual Studio Code version 1.80.0 or higher
- Python files with LangGraph code

## Development

To run the extension in development mode:

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code
4. Press F5 to launch the Extension Development Host
5. Open a Python file with LangGraph code to test

## Future Enhancements

- ✅ Interactive graph visualization with diagrams
- ✅ Export graph as image
- ✅ Navigate to node/edge definitions in code
- Custom color schemes and themes
- Save and restore graph layouts
- Animation of execution flow
- Support for more complex LangGraph patterns
- Graph validation and error detection
- Multiple layout algorithms

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

