# Test Samples

This directory contains example Python files for testing the LangGraph Visualizer extension.

## Files

### `simple_graph.py`
A basic linear graph demonstrating:
- Simple node additions
- Direct edges
- Entry and finish points

**Expected visualization:**
- Nodes: START, a, b, c, END
- Edges: START → a, a → b, b → c, c → END

### `example_graph.py`
A more complex workflow showing:
- Multiple nodes with different purposes
- Conditional edges with routing
- Loops in the graph
- END constant usage

**Expected visualization:**
- Nodes: START, start, process, decision, continue, end, END
- Direct edges and conditional edges
- Loop from continue back to process

## How to Test

1. Open the extension in development mode (F5)
2. In the new VS Code window, open any file from this directory
3. Look for the LangGraph icon in the status bar
4. Click it to see the visualization

## Adding Your Own Tests

Create new Python files in this directory following these patterns:

```python
from langgraph.graph import StateGraph

graph = StateGraph()
graph.add_node("node_name", function)
graph.add_edge("from", "to")
# etc.
```

The extension will automatically detect and parse them.

