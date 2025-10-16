# Test Samples for LangGraph Visualizer v0.2.0

This directory contains test samples to demonstrate the multi-file graph traversal capabilities of the LangGraph Visualizer extension.

## Multi-File Graph Example

### Structure
```
test_samples/
├── multi_file_main.py          # Main graph with imported subgraphs
└── workers/
    ├── __init__.py
    ├── worker_a.py             # Worker A subgraph
    └── worker_b.py             # Worker B subgraph with conditional logic
```

### Features Demonstrated

1. **Main Graph** (`multi_file_main.py`):
   - Imports subgraphs from other files
   - Contains main processing nodes
   - Uses imported graphs as nodes

2. **Worker A** (`workers/worker_a.py`):
   - Simple linear subgraph
   - Two processing steps
   - Returns compiled graph

3. **Worker B** (`workers/worker_b.py`):
   - Subgraph with conditional logic
   - Multiple processing paths
   - Conditional edges based on state

### How to Test

1. Open `multi_file_main.py` in VS Code
2. Click the LangGraph icon in the status bar
3. The extension will:
   - Analyze the main graph
   - Follow imports to `worker_a.py` and `worker_b.py`
   - Detect subgraphs within node functions
   - Build a complete hierarchical graph visualization

### Expected Results

The visualization should show:
- **Main graph** with nodes: start, main_process, worker_a, worker_b, finalize
- **Worker A subgraph** with nodes: step1, step2
- **Worker B subgraph** with nodes: step1, conditional, step2, finish
- **Hierarchical structure** showing which nodes contain subgraphs
- **File information** for each node showing source files
- **Jump-to-code** functionality for all nodes across files

### New v0.2.0 Features

- ✅ **Multi-file traversal**: Follows imports across files
- ✅ **Subgraph detection**: Finds graphs within node functions  
- ✅ **Hierarchical visualization**: Shows nested graph structure
- ✅ **File breadcrumbs**: Displays source file for each node
- ✅ **Cross-file navigation**: Jump to code in any file
- ✅ **Import tracking**: Maps file dependencies

This demonstrates the enhanced capabilities of v0.2.0 for understanding complex, multi-file LangGraph architectures!