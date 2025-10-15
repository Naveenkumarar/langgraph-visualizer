# 🚀 Get Started with LangGraph Visualizer

## ✅ What You Have

A complete VS Code extension that:
- Detects LangGraph code in Python files
- Shows a status bar icon when LangGraph is detected
- Visualizes nodes and edges in a beautiful webview panel

## 📋 Prerequisites

Before you begin, ensure you have:
- ✅ Node.js (v16 or higher) - [Download](https://nodejs.org/)
- ✅ npm (comes with Node.js)
- ✅ Visual Studio Code (v1.80.0 or higher) - [Download](https://code.visualstudio.com/)

## 🎯 Quick Start (5 Minutes)

### Step 1: Install Dependencies

Open your terminal and run:

```bash
cd /Users/naveenkumar/Downloads/development/vscode_extention/langgraph-visualizer
npm install
```

This will install:
- TypeScript compiler
- VS Code extension API types
- ESLint and other dev tools

**Expected output**: You'll see npm installing packages. This takes 1-2 minutes.

### Step 2: Compile the Extension

```bash
npm run compile
```

This compiles TypeScript files in `src/` to JavaScript in `out/`.

**Expected output**: 
```
> langgraph-visualizer@0.0.1 compile
> tsc -p ./
```

### Step 3: Open in VS Code

```bash
code .
```

Or manually:
1. Open Visual Studio Code
2. File → Open Folder
3. Select the `langgraph-visualizer` folder

### Step 4: Launch the Extension

In VS Code:
1. Press `F5` (or Run → Start Debugging)
2. A new VS Code window opens titled "Extension Development Host"
3. The extension is now running!

### Step 5: Test It

In the new window:
1. Open `test_samples/simple_graph.py`
2. Look at the bottom-right status bar
3. You should see: `$(graph) LangGraph`
4. Click it!

**Expected result**: A panel opens showing:
- Graph Type: StateGraph
- 5 Nodes (START, a, b, c, END)
- 4 Edges (START → a, a → b, b → c, c → END)

## 🎉 Success!

You've successfully:
- ✅ Built the extension
- ✅ Launched it in development mode
- ✅ Tested the visualization

## 🔄 Development Workflow

### For Active Development

Instead of `npm run compile`, use:

```bash
npm run watch
```

This auto-compiles when you save TypeScript files.

### Making Changes

1. Edit files in `src/`
2. Save (auto-compiles if using watch)
3. In Extension Development Host: `Cmd+R` (Mac) or `Ctrl+R` (Windows) to reload
4. Test your changes

### Testing

Use the files in `test_samples/`:
- `simple_graph.py` - Basic linear graph
- `example_graph.py` - Complex conditional graph

Or create your own Python files with LangGraph code!

## 📚 What's Next?

### Learn the Codebase

Read these in order:
1. `PROJECT_SUMMARY.md` - Complete overview
2. `USAGE.md` - Detailed feature guide
3. Source files in `src/` - Start with `extension.ts`

### Try Advanced Features

1. Create a complex LangGraph in Python
2. Test the conditional edges detection
3. Experiment with different graph types

### Contribute

Read `CONTRIBUTING.md` to:
- Add new features
- Improve parsing
- Enhance visualization
- Fix bugs

## 🛠️ Common Commands

```bash
# Install dependencies
npm install

# Compile once
npm run compile

# Compile on save
npm run watch

# Check for linting errors
npm run lint

# Clean build
rm -rf out && npm run compile
```

## 📖 Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Main entry point, status bar |
| `src/graphDetector.ts` | Detects LangGraph code |
| `src/graphParser.ts` | Extracts nodes and edges |
| `src/webviewProvider.ts` | Renders visualization |
| `package.json` | Extension manifest |
| `test_samples/*.py` | Example files |

## 🐛 Troubleshooting

### "Cannot find module 'vscode'"

**Fix**: Run `npm install`

### "tsc: command not found"

**Fix**: TypeScript not installed. Run `npm install`

### Extension not loading

**Fix**:
1. Ensure you compiled: `npm run compile`
2. Check for errors in Debug Console
3. Try reloading: `Cmd+R` / `Ctrl+R`

### Status bar not showing

**Fix**:
1. Ensure file is `.py`
2. File must have `from langgraph.graph import ...`
3. File must have `StateGraph(...)` or similar

### No nodes/edges detected

**Fix**:
1. Use string literals: `add_node("name", func)`
2. Check your code matches supported patterns (see USAGE.md)

## 💡 Tips

### Keyboard Shortcuts

Add a shortcut for the visualization:
1. `Cmd+K Cmd+S` to open keyboard shortcuts
2. Search "Show LangGraph Visualization"
3. Add your preferred shortcut

### Debug Mode

View extension logs:
1. In Extension Development Host
2. Help → Toggle Developer Tools
3. Check Console tab

### Multiple Graphs

Currently supports one graph per file. To visualize multiple:
1. Split into separate files
2. Open each file individually

## 🎯 Your First Enhancement

Try adding support for a new pattern:

1. Open `src/graphParser.ts`
2. Find `extractNodes()` or `extractEdges()`
3. Add a new regex pattern
4. Test with a sample file
5. Submit a PR!

## 📞 Getting Help

- Check `USAGE.md` for detailed documentation
- Read `PROJECT_SUMMARY.md` for architecture
- Open an issue on GitHub
- Review existing issues

## 🌟 Share Your Work

Once you've customized the extension:
1. Package it: `vsce package`
2. Install locally: `code --install-extension langgraph-visualizer-0.0.1.vsix`
3. Share with your team!

## ✨ What Makes This Extension Great

- **Zero Configuration**: Just install and run
- **Real-time Detection**: Updates as you type
- **Beautiful UI**: Matches VS Code theme
- **Extensible**: Easy to add features
- **Well Documented**: Every file explained

## 🚀 Ready to Start?

```bash
cd /Users/naveenkumar/Downloads/development/vscode_extention/langgraph-visualizer
npm install
npm run compile
code .
# Press F5
```

That's it! Happy coding! 🎉

---

**Need more help?** Check out:
- `QUICKSTART.md` - Quick reference
- `USAGE.md` - Detailed guide  
- `PROJECT_SUMMARY.md` - Complete overview
- `CONTRIBUTING.md` - Contribution guide

