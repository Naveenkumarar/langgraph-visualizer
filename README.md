# LangGraph Visualizer

A Visual Studio Code extension that helps you visualize LangGraph graphs directly in your editor.

## Features

- **Automatic Detection**: Automatically detects LangGraph code in Python files
- **Status Bar Integration**: Shows a convenient status bar icon when LangGraph code is detected
- **Interactive Graph Visualization**: Beautiful, interactive graph with draggable nodes powered by Cytoscape.js
- **State Visualization**: View graph state definitions with a collapsible panel in the top-right
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
   - **View State**: See state fields in the collapsible panel (top-right)
   - **Export** as PNG for documentation

## State Visualization

The extension automatically detects and displays state definitions in a collapsible panel at the top-right of the visualization:

- **State Fields**: Shows all state variables with their types and example/default values
- **Value Display**: Shows default values or generates appropriate example values based on type
- **Copy to Clipboard**: Click the 📋 icon to copy the entire state structure as JSON
- **Annotations**: Shows special annotations like `add_messages` with gear icon (⚙️)
- **State Type**: Indicates whether it's a TypedDict, dataclass, or MessagesState
- **Collapse/Expand**: Click the header to toggle the panel

### Features:
- **Smart Value Generation**: Automatically generates example values based on field types (str → "", int → 0, list → [], etc.)
- **Default Values**: Shows actual default values when defined in dataclasses
- **JSON Export**: Copy the entire state structure to clipboard as properly formatted JSON
- **Visual Feedback**: Toast notification confirms successful copy

Supported state definition types:
- **TypedDict**: Traditional state definitions
- **Dataclass**: Python dataclass with default values
- **Annotated**: Fields with reducers like `add_messages`
- **MessagesState**: Built-in message state type

## Supported LangGraph Patterns

The extension detects and parses the following patterns:

- **Graph Types**: `StateGraph`, `MessageGraph`, `Graph`
- **Nodes**: `.add_node("node_name", function)`
- **Edges**: `.add_edge("from", "to")`
- **Conditional Edges**: `.add_conditional_edges("from", function, {...})`
- **Entry Points**: `.set_entry_point("node")`
- **Finish Points**: `.set_finish_point("node")`
- **State Definitions**: 
  - TypedDict: `class State(TypedDict):`
  - Dataclass: `@dataclass class State:`
  - Annotated fields: `field: Annotated[type, annotation]`
  - MessagesState: `class State(MessagesState):`

## Example

```python
from typing import TypedDict
from langgraph.graph import StateGraph

# Define state
class State(TypedDict):
    messages: list[str]
    user_input: str
    response: str

# Create a graph
graph = StateGraph(State)

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
- **State Panel**: View state fields, types, and default values in the top-right (collapsible)
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

