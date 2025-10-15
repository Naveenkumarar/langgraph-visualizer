# Quick Start Guide

Get the LangGraph Visualizer up and running in 5 minutes!

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Visual Studio Code (v1.80.0 or higher)

## Setup (3 steps)

### 1. Install Dependencies

```bash
cd /Users/naveenkumar/Downloads/development/vscode_extention/langgraph-visualizer
npm install
```

### 2. Compile the Extension

```bash
npm run compile
```

### 3. Launch Extension

Open the project in VS Code and press `F5`

A new VS Code window will open with your extension loaded!

## Test It Out

1. In the new window, open: `test_samples/simple_graph.py`
2. Look at the bottom-right status bar
3. You should see: `$(graph) LangGraph`
4. Click it!

You'll see a panel showing:
- Nodes: START, a, b, c, END
- Edges: START → a, a → b, b → c, c → END

## What's Happening?

### Behind the Scenes

1. **Detection**: The extension scans your Python file for:
   - `from langgraph.graph import ...`
   - `StateGraph(...)` or similar classes

2. **Parsing**: It extracts:
   - Nodes from `add_node("name", func)`
   - Edges from `add_edge("from", "to")`
   - Conditional edges from `add_conditional_edges(...)`

3. **Display**: Shows everything in a clean webview

## Next Steps

- Try `test_samples/example_graph.py` for a complex example
- Create your own LangGraph code and test it
- Read `USAGE.md` for detailed documentation

## Troubleshooting

**Extension not loading?**
- Make sure you compiled: `npm run compile`
- Check the Debug Console in VS Code for errors

**Status bar not showing?**
- Ensure your Python file has LangGraph imports
- Check that you have `StateGraph()` or similar classes

**No nodes/edges?**
- Use string literals: `add_node("name", func)`
- Avoid dynamic/computed node names for now

## Development Mode

For active development:

```bash
npm run watch
```

This auto-compiles as you edit TypeScript files.

## Key Files to Explore

- `src/extension.ts` - Main entry point
- `src/graphParser.ts` - Where the magic happens
- `src/webviewProvider.ts` - HTML rendering
- `test_samples/` - Example files

## Need Help?

Check out:
- `USAGE.md` - Comprehensive guide
- `README.md` - Feature overview
- Open an issue on GitHub

Happy visualizing! 🎉

