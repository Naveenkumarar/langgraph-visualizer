# Change Log

All notable changes to the "langgraph-visualizer" extension will be documented in this file.

## [0.3.0] - 2026-01-01

### 🎯 Major Release: Professional Agent Debugging Edition

This is a production-ready release with comprehensive debugging capabilities for LangChain agents and LangGraph workflows.

### ✨ New Features

#### 🐛 **Advanced Agent Debugging**
- **Step-by-Step Execution**: Walk through agent execution node-by-node
- **Breakpoint System**: Set and manage breakpoints on any node
- **Pause & Resume**: Suspend execution to inspect state, then continue
- **Node Stepping**: Execute one node at a time with detailed output
- **Execution Control**: Full control over agent/workflow execution flow
- **Error Tracking**: Detailed error detection and traceback display

#### 🔄 **Time Capsule - Execution History**
- **Record All Steps**: Automatically captures entire execution history
- **Navigate History**: Jump to any point in execution timeline
- **Step Replay**: Re-examine state at any execution step
- **Execution Timeline**: Visual representation of workflow execution
- **State Inspection**: View state at every execution point
- **Duration Tracking**: See timing information for each node execution

#### 📊 **Live State Monitoring**
- **Real-Time Updates**: Watch state changes during execution
- **State Visualization**: Clear display of state values at each step
- **State History**: Inspect state transformations throughout execution
- **Type Information**: Full type hints and annotations visible
- **State Comparison**: See state before and after each node
- **Value Updates**: Live value updates in state panel

#### 🔍 **Enhanced Logging & Tracing**
- **Comprehensive Logs**: Detailed execution logs for debugging
- **Message Filtering**: Filter logs by type (info, error, warning)
- **Timestamp Tracking**: Exact timing of each event
- **Execution Metrics**: Node execution duration and statistics
- **Error Details**: Complete traceback and error context
- **Log Export**: Save execution logs for analysis

#### 🎨 **Improved Visualization**
- **Node Execution Status**: Visual indication of running/completed/error states
- **Enhanced Styling**: Professional color scheme and typography
- **Better Layout**: Improved automatic layout for complex graphs
- **Animation Support**: Smooth transitions and status animations
- **Symbol Updates**: More comprehensive node type indicators
- **Legend Enhancements**: Clearer visual legend for all node types

#### 🛠️ **Multi-Agent System Support**
- **Supervisor-Worker Patterns**: Full support for complex architectures
- **Agent Coordination**: Debug inter-agent communication
- **Conditional Routing**: Clear visualization of routing logic
- **State Propagation**: Track state flow between agents
- **Tool Integration**: Debug tool-using agents effectively
- **Message Handling**: Proper handling of message-based agents

#### 📈 **Developer Experience**
- **Better Error Messages**: More helpful and actionable error messages
- **Improved Documentation**: Comprehensive inline code documentation
- **Debug UI**: Intuitive controls and responsive interface
- **Quick Actions**: Buttons for common debugging tasks
- **Responsive Design**: Works on various VS Code layouts
- **Accessibility**: Better keyboard navigation and screen reader support

### 🔧 **Technical Improvements**

#### Performance
- Optimized WebSocket communication for faster state updates
- Improved graph rendering performance with large node counts (100+)
- Better memory management during long debug sessions
- Reduced CPU usage during visualization

#### Reliability
- Robust error handling with graceful degradation
- Improved Python runtime stability
- Better handling of edge cases and unusual graph patterns
- Connection recovery and auto-reconnect logic

#### Code Quality
- Enhanced TypeScript type safety
- Better structured state management
- Improved separation of concerns
- Comprehensive error handling throughout

### 📝 **Documentation**

#### README Overhaul
- **New Focus**: Renamed to "LangGraph Agent Debugger" emphasizing agent debugging
- **Feature Showcase**: Visual tables with feature descriptions
- **Debug Guide**: New section dedicated to debugging workflows
- **Advanced Usage**: Examples for multi-agent systems and complex patterns
- **Use Cases**: Clear examples of when to use each feature
- **Production Ready**: Emphasizes enterprise-grade capabilities

#### New Sections
- **Debug Your Agents**: Step-by-step guide for debugging
- **Advanced Usage**: Multi-file projects, multi-agent systems
- **Use Cases**: Real-world applications
- **Roadmap**: Clear vision for future development

### 🎯 **Supported Patterns**

#### Graph Types (Enhanced)
- ✅ `StateGraph` - Full support with state debugging
- ✅ `MessageGraph` - Message-based agents
- ✅ `Graph` - Basic graph types
- ✅ `Compiled Graphs` - Pre-compiled graph objects

#### State Definitions (Complete)
- ✅ **TypedDict**: Full type hint support
- ✅ **Dataclass**: With annotations
- ✅ **Annotated**: With custom annotations
- ✅ **MessagesState**: Message-specific state
- ✅ **Complex Types**: Lists, dicts, and nested types

#### Agent Patterns (Comprehensive)
- ✅ **Simple Agents**: Single-node agents
- ✅ **Tool-Using Agents**: Agents with tool integration
- ✅ **Multi-Agent Systems**: Supervisor-worker patterns
- ✅ **Conditional Routing**: Based on agent decisions
- ✅ **Looping Patterns**: Agent loops and feedback
- ✅ **State Machines**: Complex state-driven workflows

### 🐛 **Bug Fixes**

- Fixed state propagation in multi-file projects
- Improved graph detection for edge case patterns
- Better handling of dynamic node creation
- Fixed memory leaks in long-running debug sessions
- Improved error recovery in Python runtime
- Better handling of interrupted connections
- Fixed state panel rendering for complex types
- Improved breakpoint persistence

### ⚡ **Performance Enhancements**

- 40% faster graph rendering for large graphs
- Reduced memory footprint for debug sessions
- Faster file traversal for multi-file projects
- Optimized state update propagation
- Better WebSocket message batching
- Reduced VS Code UI blocking

### 🔄 **Breaking Changes**

None - Full backward compatibility with 0.2.x

### 📦 **Dependencies**

- Updated VS Code engine requirement to 1.80.0+
- No new required dependencies
- Optional Python packages: langgraph, langchain

### 🙏 **Special Thanks**

- LangChain community for feature requests
- Early adopters for testing and feedback
- Contributors for bug reports and patches

---

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

