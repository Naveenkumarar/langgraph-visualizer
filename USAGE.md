# LangGraph Visualizer - Usage Guide

## Getting Started

### Installation for Development

1. **Clone and Setup**
   ```bash
   cd /Users/naveenkumar/Downloads/development/vscode_extention/langgraph-visualizer
   npm install
   ```

2. **Compile the Extension**
   ```bash
   npm run compile
   ```
   
   Or for continuous compilation:
   ```bash
   npm run watch
   ```

3. **Run the Extension**
   - Open the project in VS Code
   - Press `F5` to launch the Extension Development Host
   - A new VS Code window will open with the extension activated

### Using the Extension

#### Step 1: Open a Python File with LangGraph

Open any Python file that contains LangGraph code. The extension will automatically detect:
- LangGraph imports (`from langgraph.graph import ...`)
- LangGraph classes (`StateGraph`, `MessageGraph`, `Graph`)

#### Step 2: Look for the Status Bar Icon

When LangGraph code is detected, you'll see a status bar item in the bottom-right corner:
```
$(graph) LangGraph
```

The tooltip will show the detected graph types.

#### Step 3: Click to Visualize

Click the status bar icon to open the visualization panel. You'll see:
- **Graph Type**: The type of graph detected (StateGraph, MessageGraph, etc.)
- **Statistics**: Number of nodes and edges
- **Nodes List**: All nodes with their types (start, end, regular)
- **Edges List**: All connections between nodes

## Supported Patterns

### Graph Creation

```python
from langgraph.graph import StateGraph, MessageGraph, Graph

# StateGraph
graph = StateGraph(State)

# MessageGraph
graph = MessageGraph()

# Generic Graph
graph = Graph()
```

### Adding Nodes

```python
# Basic node addition
graph.add_node("node_name", function_name)
graph.add_node("process", process_data)
graph.add_node("validate", validate_input)
```

### Adding Edges

#### Direct Edges
```python
# Simple edge from one node to another
graph.add_edge("start", "process")
graph.add_edge("process", "end")
```

#### Conditional Edges
```python
# Conditional routing
graph.add_conditional_edges(
    "decision_node",
    routing_function,
    {
        "path_a": "node_a",
        "path_b": "node_b",
        "default": "fallback_node"
    }
)
```

### Entry and Exit Points

```python
# Set where the graph starts
graph.set_entry_point("start_node")

# Set where the graph ends
graph.set_finish_point("end_node")

# Or use END constant
from langgraph.graph import END
graph.add_edge("final_node", END)
```

## Examples

### Example 1: Linear Workflow

See `test_samples/simple_graph.py`:
- Creates a linear graph with nodes a → b → c
- Shows entry and finish points
- Displays all connections

### Example 2: Conditional Workflow

See `test_samples/example_graph.py`:
- Creates a complex graph with conditional routing
- Shows different node types
- Demonstrates loops and decision points

## Troubleshooting

### Status Bar Not Showing

**Possible causes:**
- File is not a Python file (.py extension)
- No LangGraph imports found
- No graph instantiation detected

**Solution:**
- Ensure your file has: `from langgraph.graph import StateGraph` (or similar)
- Ensure you have code like: `graph = StateGraph(...)`

### No Nodes/Edges Detected

**Possible causes:**
- Graph construction uses variables instead of string literals
- Non-standard patterns not yet supported

**Solution:**
- Use string literals for node names: `graph.add_node("name", func)`
- Check that your code matches supported patterns (see above)

### Webview Shows Empty

**Possible causes:**
- Graph structure is dynamic or complex
- Uses advanced patterns not yet supported

**Solution:**
- Currently, the extension works best with static, string-based node names
- Future versions will support more dynamic patterns

## Development Notes

### Project Structure

```
langgraph-visualizer/
├── src/
│   ├── extension.ts         # Main entry, orchestrates everything
│   ├── graphDetector.ts     # Detects LangGraph in files
│   ├── graphParser.ts       # Extracts nodes/edges
│   └── webviewProvider.ts   # Renders visualization
├── test_samples/            # Example Python files
├── media/                   # Icons and CSS
└── out/                     # Compiled JavaScript (generated)
```

### Key Components

1. **GraphDetector**: Scans text for LangGraph patterns
2. **GraphParser**: Uses regex to extract graph structure
3. **WebviewProvider**: Generates HTML visualization
4. **Extension**: Manages status bar and commands

### Extending the Parser

To add support for new patterns, edit `src/graphParser.ts`:
- Add regex patterns in `extractNodes()` or `extractEdges()`
- Test with sample files in `test_samples/`

## Keyboard Shortcuts

You can add custom keyboard shortcuts for the extension:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Preferences: Open Keyboard Shortcuts"
3. Search for "Show LangGraph Visualization"
4. Add your preferred shortcut

## Future Features

The following features are planned for future releases:

- [ ] Interactive graph visualization with D3.js or similar
- [ ] Export graph as PNG/SVG
- [ ] Click nodes to jump to code
- [ ] Support for dynamic node names
- [ ] Graph validation and error checking
- [ ] Multiple graph detection in one file
- [ ] Diff view for graph changes

## Contributing

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with sample files
5. Submit a pull request

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Refer to the VS Code Extension API docs

