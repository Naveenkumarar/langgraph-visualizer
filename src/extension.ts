import * as vscode from 'vscode';
import { GraphDetector } from './graphDetector';
import { GraphParser } from './graphParser';
import { WebviewProvider } from './webviewProvider';
import { FileTraverser } from './fileTraverser';
import { getDebugSession, DebugSession } from './debugSession';

let statusBarItem: vscode.StatusBarItem;
let debugSession: DebugSession;

export function activate(context: vscode.ExtensionContext) {

    // Initialize debug session
    debugSession = getDebugSession();

    // Create status bar item for visualization
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'langgraph-visualizer.showGraph';
    statusBarItem.text = '$(graph) LangGraph';
    statusBarItem.tooltip = 'Show LangGraph Visualization';
    context.subscriptions.push(statusBarItem);

    // Update webview with debug state changes
    debugSession.onStateChange((state) => {
        WebviewProvider.updateDebugState(state);
    });

    // Forward node updates to webview
    debugSession.onNodeUpdate((nodeExec) => {
        WebviewProvider.updateNodeExecution(nodeExec);
    });

    // Forward log entries to webview
    debugSession.onLogEntry((logEntry) => {
        WebviewProvider.addLogEntry(logEntry);
    });

    // Function to load and display graph
    const loadAndDisplayGraph = async (document: vscode.TextDocument, showMessages: boolean = true) => {
        if (!GraphDetector.hasLangGraph(document)) {
            if (showMessages) {
                vscode.window.showWarningMessage('No LangGraph code detected in the current file');
            }
            return;
        }

        try {
            if (showMessages) {
                vscode.window.showInformationMessage('🔍 Analyzing graph structure...');
            }

            // Get workspace root
            const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
            if (!workspaceRoot) {
                if (showMessages) {
                    vscode.window.showErrorMessage('No workspace root found');
                }
                return;
            }

            // Create file traverser and build complete graph hierarchy
            const fileTraverser = new FileTraverser(workspaceRoot);
            const graphData = await fileTraverser.buildGraphHierarchy(document.fileName);

            if (graphData.nodes.length === 0) {
                if (showMessages) {
                    vscode.window.showInformationMessage('No graph structure found in this file or its dependencies');
                }
                return;
            }

            // Create refresh callback for auto-reload
            const refreshCallback = async () => {
                const currentDoc = vscode.window.activeTextEditor?.document || document;
                const updatedGraphData = await fileTraverser.buildGraphHierarchy(currentDoc.fileName);
                WebviewProvider.update(updatedGraphData);
                console.log('LangGraph Visualizer - Graph reloaded');
            };

            // Show the complete graph hierarchy in webview
            WebviewProvider.show(context, graphData, document, refreshCallback);

            if (showMessages) {
                // Show success message with stats
                const totalNodes = countTotalNodes(graphData);
                const totalFiles = countTotalFiles(graphData);
                vscode.window.showInformationMessage(
                    `✅ Graph loaded: ${totalNodes} nodes across ${totalFiles} files`
                );
            }

        } catch (error) {
            console.error('Error in loadAndDisplayGraph:', error);
            if (showMessages) {
                vscode.window.showErrorMessage(`Failed to analyze graph: ${error}`);
            }
        }
    };

    // Register the show graph command
    const showGraphCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.showGraph',
        async (uri?: vscode.Uri) => {
            let document: vscode.TextDocument;

            if (uri) {
                // Command invoked from explorer context menu with a file URI
                try {
                    document = await vscode.workspace.openTextDocument(uri);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to open file: ${error}`);
                    return;
                }
            } else {
                // Command invoked from command palette or editor context menu
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor found');
                    return;
                }
                document = editor.document;
            }

            await loadAndDisplayGraph(document, true);
        }
    );
    context.subscriptions.push(showGraphCommand);

    // Register debug commands
    const toggleDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.toggleDebug',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            if (debugSession.isActive()) {
                await debugSession.stop();
            } else {
                await debugSession.start(editor.document);
            }
        }
    );
    context.subscriptions.push(toggleDebugCommand);

    const startDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.startDebug',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            if (!debugSession.isActive()) {
                await debugSession.start(editor.document);
            } else {
                vscode.window.showWarningMessage('Debug session already active');
            }
        }
    );
    context.subscriptions.push(startDebugCommand);

    const startDebugWithPathCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.startDebugWithPath',
        async (pythonPath?: string) => {
            // Try to get document from webview first, then fall back to active editor
            let document = WebviewProvider.getCurrentDocument();
            
            if (!document) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    document = editor.document;
                }
            }
            
            if (!document) {
                vscode.window.showErrorMessage('No Python file found. Please open a Python file first.');
                return;
            }

            if (pythonPath) {
                debugSession.setPythonPath(pythonPath);
            }

            if (!debugSession.isActive()) {
                await debugSession.start(document);
            } else {
                vscode.window.showWarningMessage('Debug session already active');
            }
        }
    );
    context.subscriptions.push(startDebugWithPathCommand);

    const setPythonPathCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.setPythonPath',
        async (pythonPath: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            if (debugSession.isActive()) {
                debugSession.restartWithPythonPath(pythonPath, editor.document);
            } else {
                debugSession.setPythonPath(pythonPath);
            }
        }
    );
    context.subscriptions.push(setPythonPathCommand);

    const stopDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.stopDebug',
        async () => {
            await debugSession.stop();
        }
    );
    context.subscriptions.push(stopDebugCommand);

    const pauseDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.pauseDebug',
        () => {
            debugSession.pause();
        }
    );
    context.subscriptions.push(pauseDebugCommand);

    const resumeDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.resumeDebug',
        () => {
            debugSession.resume();
        }
    );
    context.subscriptions.push(resumeDebugCommand);

    const stepDebugCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.stepDebug',
        () => {
            debugSession.step();
        }
    );
    context.subscriptions.push(stepDebugCommand);

    const toggleBreakpointCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.toggleBreakpoint',
        (nodeId: string) => {
            debugSession.toggleBreakpoint(nodeId);
        }
    );
    context.subscriptions.push(toggleBreakpointCommand);

    // Time Capsule commands
    const timeCapsuleActivateCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.timeCapsuleActivate',
        () => {
            debugSession.activateTimeCapsule();
        }
    );
    context.subscriptions.push(timeCapsuleActivateCommand);

    const timeCapsuleDeactivateCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.timeCapsuleDeactivate',
        () => {
            debugSession.deactivateTimeCapsule();
        }
    );
    context.subscriptions.push(timeCapsuleDeactivateCommand);

    const timeCapsuleNextCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.timeCapsuleNext',
        () => {
            debugSession.timeCapsuleNext();
        }
    );
    context.subscriptions.push(timeCapsuleNextCommand);

    const timeCapsulePreviousCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.timeCapsulePrevious',
        () => {
            debugSession.timeCapsulePrevious();
        }
    );
    context.subscriptions.push(timeCapsulePreviousCommand);

    // Update status bar when editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
    );

    // Update status bar when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                updateStatusBar(vscode.window.activeTextEditor);
            }
        })
    );

    // Initial status bar update
    updateStatusBar(vscode.window.activeTextEditor);
}

/**
 * Update the status bar visibility based on current document
 */
function updateStatusBar(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
        statusBarItem.hide();
        return;
    }

    const document = editor.document;

    if (GraphDetector.hasLangGraph(document)) {
        const graphTypes = GraphDetector.getDetectedGraphTypes(document);
        const typesList = graphTypes.join(', ');
        statusBarItem.tooltip = `Show LangGraph Visualization (${typesList})`;
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

/**
 * Count total nodes in a graph structure including subgraphs
 */
function countTotalNodes(graph: any): number {
    let count = graph.nodes.length;
    if (graph.subgraphs) {
        for (const subgraph of graph.subgraphs) {
            count += countTotalNodes(subgraph);
        }
    }
    for (const node of graph.nodes) {
        if (node.subgraph) {
            count += countTotalNodes(node.subgraph);
        }
    }
    return count;
}

/**
 * Count total files in a graph structure
 */
function countTotalFiles(graph: any): number {
    const files = new Set<string>();
    if (graph.filePath) {
        files.add(graph.filePath);
    }
    if (graph.subgraphs) {
        for (const subgraph of graph.subgraphs) {
            countTotalFilesRecursive(subgraph, files);
        }
    }
    for (const node of graph.nodes) {
        if (node.filePath) {
            files.add(node.filePath);
        }
        if (node.subgraph) {
            countTotalFilesRecursive(node.subgraph, files);
        }
    }
    return files.size;
}

function countTotalFilesRecursive(graph: any, files: Set<string>): void {
    if (graph.filePath) {
        files.add(graph.filePath);
    }
    if (graph.subgraphs) {
        for (const subgraph of graph.subgraphs) {
            countTotalFilesRecursive(subgraph, files);
        }
    }
    if (graph.nodes) {
        for (const node of graph.nodes) {
            if (node.filePath) {
                files.add(node.filePath);
            }
            if (node.subgraph) {
                countTotalFilesRecursive(node.subgraph, files);
            }
        }
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    if (debugSession) {
        debugSession.stop();
    }
}

