import * as vscode from 'vscode';
import { GraphStructure } from './graphParser';
import { DebugSessionState, NodeExecution, ExecutionLogEntry } from './debugSession';

/**
 * Provides webview panel for graph visualization
 */
export class WebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentDocument: vscode.TextDocument | undefined;
    private static fileWatcher: vscode.FileSystemWatcher | undefined;
    private static context: vscode.ExtensionContext | undefined;
    private static refreshCallback: (() => Promise<void>) | undefined;
    private static debugState: DebugSessionState | undefined;

    /**
     * Get the current document being visualized
     */
    public static getCurrentDocument(): vscode.TextDocument | undefined {
        return WebviewProvider.currentDocument;
    }

    /**
     * Show the graph visualization in a webview panel
     */
    public static show(
        context: vscode.ExtensionContext,
        graphData: GraphStructure,
        document: vscode.TextDocument,
        refreshCallback?: () => Promise<void>
    ): void {
        WebviewProvider.currentDocument = document;
        WebviewProvider.context = context;
        WebviewProvider.refreshCallback = refreshCallback;

        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.reveal(column);
            WebviewProvider.currentPanel.webview.html = this.getWebviewContent(graphData);
        } else {
            // Set up file watcher for auto-reload
            WebviewProvider.setupFileWatcher(document);

            const panel = vscode.window.createWebviewPanel(
                'langgraphVisualizer',
                'LangGraph Visualization',
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            WebviewProvider.currentPanel = panel;
            panel.webview.html = this.getWebviewContent(graphData);

            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'jumpToCode':
                            if (message.lineNumber) {
                                const line = message.lineNumber - 1;

                                // Helper function to jump to line in a document
                                const jumpToLineInDocument = (document: vscode.TextDocument, lineNumber: number) => {
                                    const lineText = document.lineAt(lineNumber).text;
                                    const lineLength = lineText.length;
                                    const range = new vscode.Range(lineNumber, 0, lineNumber, lineLength);

                                    vscode.window.showTextDocument(document, {
                                        viewColumn: vscode.ViewColumn.One,
                                        preserveFocus: false,
                                        preview: false
                                    }).then(editor => {
                                        setTimeout(() => {
                                            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                                            editor.selection = new vscode.Selection(lineNumber, 0, lineNumber, lineLength);

                                            const decoration = vscode.window.createTextEditorDecorationType({
                                                backgroundColor: '#FFD700',
                                                border: '3px solid #FF6B6B',
                                                borderRadius: '5px',
                                                fontWeight: 'bold',
                                                opacity: '0.9'
                                            });

                                            let blinkCount = 0;
                                            const maxBlinks = 8;
                                            const blinkInterval = 500;

                                            const blink = () => {
                                                if (blinkCount % 2 === 0) {
                                                    editor.setDecorations(decoration, [range]);
                                                } else {
                                                    editor.setDecorations(decoration, []);
                                                }
                                                blinkCount++;

                                                if (blinkCount < maxBlinks) {
                                                    setTimeout(blink, blinkInterval);
                                                } else {
                                                    decoration.dispose();
                                                }
                                            };

                                            blink();
                                        }, 100);
                                    });
                                };

                                // Use the provided filePath or fallback to current document
                                if (message.filePath) {
                                    // Open the specific file
                                    const targetUri = vscode.Uri.file(message.filePath);
                                    vscode.workspace.openTextDocument(targetUri).then(doc => {
                                        jumpToLineInDocument(doc, line);
                                    }, (error: any) => {
                                        vscode.window.showErrorMessage(`Could not open file: ${message.filePath}`);
                                        console.error('Error opening file:', error);
                                    });
                                } else {
                                    // Fallback to current document
                                    const document = WebviewProvider.currentDocument || vscode.window.activeTextEditor?.document;
                                    if (!document) {
                                        vscode.window.showErrorMessage('No document found. Please open the Python file first.');
                                        return;
                                    }
                                    jumpToLineInDocument(document, line);
                                }
                            }
                            break;
                        case 'copyToClipboard':
                            // Handle clipboard copy using VS Code API
                            if (message.text) {
                                vscode.env.clipboard.writeText(message.text).then(() => {
                                    // Send success message back to webview
                                    panel.webview.postMessage({ command: 'clipboardCopySuccess' });
                                }, (error: any) => {
                                    console.error('Failed to copy to clipboard:', error);
                                    panel.webview.postMessage({ command: 'clipboardCopyError', error: error.message });
                                });
                            }
                            break;
                        
                        // Debug commands from webview
                        case 'debugStop':
                            vscode.commands.executeCommand('langgraph-visualizer.stopDebug');
                            break;
                        case 'debugStart':
                            vscode.commands.executeCommand('langgraph-visualizer.startDebugWithPath', message.pythonPath);
                            break;
                        case 'setPythonPath':
                            vscode.commands.executeCommand('langgraph-visualizer.setPythonPath', message.pythonPath);
                            break;
                        case 'toggleBreakpoint':
                            if (message.nodeId) {
                                vscode.commands.executeCommand('langgraph-visualizer.toggleBreakpoint', message.nodeId);
                            }
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );

            panel.onDidDispose(() => {
                WebviewProvider.currentPanel = undefined;
                WebviewProvider.disposeFileWatcher();
            }, null, context.subscriptions);
        }
    }

    /**
     * Set up file watcher for auto-reload
     */
    private static setupFileWatcher(document: vscode.TextDocument): void {
        // Clean up any existing watcher
        WebviewProvider.disposeFileWatcher();

        // Get workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return;
        }

        // Watch all Python files in the workspace
        const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.py');
        WebviewProvider.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Debounce timer to avoid excessive reloads
        let reloadTimer: NodeJS.Timeout | undefined;
        const debounceDelay = 500; // 500ms delay

        const scheduleReload = () => {
            if (reloadTimer) {
                clearTimeout(reloadTimer);
            }
            reloadTimer = setTimeout(async () => {
                if (WebviewProvider.refreshCallback && WebviewProvider.currentPanel) {
                    console.log('LangGraph Visualizer - File changed, reloading graph...');
                    try {
                        await WebviewProvider.refreshCallback();
                    } catch (error) {
                        console.error('Error reloading graph:', error);
                    }
                }
            }, debounceDelay);
        };

        // Listen for file changes
        WebviewProvider.fileWatcher.onDidChange(scheduleReload);
        WebviewProvider.fileWatcher.onDidCreate(scheduleReload);
        WebviewProvider.fileWatcher.onDidDelete(scheduleReload);

        console.log('LangGraph Visualizer - File watcher set up for auto-reload');
    }

    /**
     * Dispose file watcher
     */
    private static disposeFileWatcher(): void {
        if (WebviewProvider.fileWatcher) {
            WebviewProvider.fileWatcher.dispose();
            WebviewProvider.fileWatcher = undefined;
            console.log('LangGraph Visualizer - File watcher disposed');
        }
    }

    /**
     * Update the webview with new graph data
     */
    public static update(graphData: GraphStructure): void {
        if (WebviewProvider.currentPanel) {
            // Show reload toast before updating
            WebviewProvider.currentPanel.webview.postMessage({ command: 'showReloadToast' });

            // Update the webview content
            setTimeout(() => {
                WebviewProvider.currentPanel!.webview.html = this.getWebviewContent(graphData);
            }, 100);
        }
    }

    /**
     * Update debug state in the webview
     */
    public static updateDebugState(state: DebugSessionState): void {
        WebviewProvider.debugState = state;
        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.webview.postMessage({
                command: 'debugStateUpdate',
                state: {
                    isActive: state.isActive,
                    executionState: state.executionState,
                    currentNode: state.currentNode,
                    currentState: state.currentState,
                    initialInput: state.initialInput,
                    finalOutput: state.finalOutput,
                    breakpoints: Array.from(state.breakpoints),
                    port: state.port,
                    pythonPath: state.pythonPath
                }
            });
        }
    }

    /**
     * Update node execution in the webview
     */
    public static updateNodeExecution(nodeExec: NodeExecution): void {
        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.webview.postMessage({
                command: 'nodeExecutionUpdate',
                nodeExecution: nodeExec
            });
        }
    }

    /**
     * Add log entry to the webview
     */
    public static addLogEntry(logEntry: ExecutionLogEntry): void {
        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.webview.postMessage({
                command: 'addLogEntry',
                logEntry: logEntry
            });
        }
    }

    /**
     * Generate webview HTML content
     */
    private static getWebviewContent(graphData: GraphStructure): string {
        const cytoscapeData = this.convertToCytoscapeFormat(graphData);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LangGraph Visualization</title>
    <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
    <script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
    <script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #header {
            padding: 15px 20px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        
        #header h1 {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }
        
        #controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .control-group {
            display: flex;
            gap: 5px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:active {
            transform: translateY(1px);
        }
        
        .search-box {
            position: relative;
            display: flex;
            align-items: center;
        }
        
        #searchInput {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 30px 6px 10px;
            border-radius: 3px;
            font-size: 13px;
            width: 200px;
            outline: none;
        }
        
        #searchInput:focus {
            border-color: var(--vscode-focusBorder);
        }
        
        #searchInput::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        
        .search-icon {
            position: absolute;
            right: 8px;
            color: var(--vscode-descriptionForeground);
            pointer-events: none;
        }
        
        #stats {
            display: flex;
            gap: 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .stat-value {
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .graph-type-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
        }
        
        #cy {
            flex: 1;
            background-color: var(--vscode-editor-background);
            position: relative;
        }
        
        #legend {
            position: absolute;
            bottom: 60px;
            right: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 12px;
            font-size: 12px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            max-height: 400px;
            overflow-y: auto;
        }

        #statePanel {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            font-size: 12px;
            z-index: 1001;
            backdrop-filter: blur(10px);
            min-width: 250px;
            max-width: 400px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
        }

        #statePanel.collapsed {
            max-height: 40px;
        }

        #statePanel.hidden {
            display: none;
        }

        .state-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            user-select: none;
        }

        .state-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .state-header h3 {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .state-type-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
        }

        .collapse-icon {
            font-size: 16px;
            transition: transform 0.3s ease;
        }

        #statePanel.collapsed .collapse-icon {
            transform: rotate(-90deg);
        }

        .state-content {
            padding: 12px;
            overflow-y: auto;
            flex: 1;
        }

        #statePanel.collapsed .state-content {
            display: none;
        }

        .state-field {
            margin: 8px 0;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-radius: 3px;
            border-left: 3px solid var(--vscode-button-background);
            transition: border-color 0.3s ease;
        }

        .state-field-value.live-value {
            color: var(--vscode-charts-green);
            font-weight: 500;
        }

        .state-field-value.value-updated {
            animation: valueFlash 0.5s ease;
        }

        @keyframes valueFlash {
            0% { background-color: var(--vscode-charts-green); }
            100% { background-color: transparent; }
        }

        .state-field-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }

        .state-field-name {
            font-weight: 600;
            color: var(--vscode-foreground);
            font-size: 12px;
            font-family: var(--vscode-editor-font-family);
        }

        .state-field-type {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
            font-style: italic;
        }

        .state-field-value {
            color: var(--vscode-textLink-foreground);
            font-size: 11px;
            margin-top: 4px;
            padding: 4px 6px;
            background-color: var(--vscode-input-background);
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
            border: 1px solid var(--vscode-input-border);
            word-break: break-all;
        }

        .state-field-annotation {
            color: var(--vscode-editorWarning-foreground);
            font-size: 10px;
            margin-top: 4px;
            font-family: var(--vscode-editor-font-family);
        }

        .copy-state-btn {
            background-color: transparent;
            color: var(--vscode-foreground);
            border: none;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 14px;
            border-radius: 3px;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .copy-state-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .copy-state-btn:active {
            transform: scale(0.95);
        }

        .copy-toast {
            position: fixed;
            bottom: 80px;
            right: 20px;
            background-color: var(--vscode-notifications-background);
            color: var(--vscode-notifications-foreground);
            border: 1px solid var(--vscode-notifications-border);
            padding: 10px 16px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: none;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        }

        .copy-toast.show {
            display: flex;
        }

        .copy-toast-icon {
            color: var(--vscode-notificationsInfoIcon-foreground);
        }

        .no-state-message {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        
        #legend h3 {
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 5px 0;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .legend-color.start { background-color: #4CAF50; }
        .legend-color.node { background-color: #2196F3; }
        .legend-color.end { background-color: #F44336; }
        .legend-color.tool { 
            background-color: #9C27B0;
            clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
        }
        .legend-color.agent { 
            background-color: #FF9800;
            transform: rotate(45deg);
        }
        .legend-color.direct { 
            width: 30px;
            height: 3px;
            background-color: #2196F3;
            border: none;
        }
        .legend-color.conditional { 
            width: 30px;
            height: 3px;
            background-color: #FF9800;
            border: none;
        }
        .legend-color.bidirectional { 
            width: 30px;
            height: 3px;
            background-color: #9C27B0;
            border: none;
        }
        .legend-color.subgraph-entry { 
            width: 30px;
            height: 3px;
            background-color: #4CAF50;
            border: none;
        }
        .legend-color.subgraph-exit { 
            width: 30px;
            height: 3px;
            background-color: #F44336;
            border: none;
        }
        .legend-color.main-graph-parent { 
            width: 30px;
            height: 20px;
            background-color: #fff3e0;
            border: 4px solid #ff9800;
            border-radius: 3px;
        }
        .legend-color.subgraph-parent { 
            width: 30px;
            height: 20px;
            background-color: #f0f8ff;
            border: 3px solid #2196f3;
            border-radius: 3px;
        }
        
        #nodeInfo {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 12px;
            font-size: 12px;
            z-index: 1000;
            min-width: 250px;
            display: none;
            backdrop-filter: blur(10px);
        }
        
        #nodeInfo.visible {
            display: block;
        }
        
        #nodeInfo h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .node-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            text-transform: uppercase;
        }
        
        .node-badge.start { background-color: #4CAF50; color: white; }
        .node-badge.node { background-color: #2196F3; color: white; }
        .node-badge.end { background-color: #F44336; color: white; }
        .node-badge.tool { background-color: #9C27B0; color: white; }
        .node-badge.agent { background-color: #FF9800; color: white; }
        
        .info-row {
            margin: 5px 0;
            display: flex;
            gap: 8px;
        }
        
        .info-label {
            color: var(--vscode-descriptionForeground);
            min-width: 70px;
        }
        
        .info-value {
            color: var(--vscode-foreground);
            font-weight: 500;
        }
        
        .jump-button {
            margin-top: 8px;
            width: 100%;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .jump-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        #helpText {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            z-index: 999;
        }
        
        #helpText.hidden {
            display: none;
        }
        
        .help-icon {
            font-size: 48px;
            margin-bottom: 10px;
            opacity: 0.5;
        }
        
        .zoom-controls {
            position: absolute;
            bottom: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            z-index: 1000;
        }
        
        .zoom-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }
        
        .zoom-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Auto-reload toast notification */
        #reloadToast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: var(--vscode-notifications-background);
            color: var(--vscode-notifications-foreground);
            border: 1px solid var(--vscode-notifications-border);
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: none;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        }
        
        #reloadToast.show {
            display: flex;
        }
        
        @keyframes slideIn {
            from {
                transform: translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .reload-icon {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }

        /* Debug Controls Bar (separate line) */
        .debug-controls-bar {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 10px 20px;
            flex-shrink: 0;
        }

        .debug-controls-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }

        .debug-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }

        .debug-center {
            display: flex;
            align-items: center;
        }

        .debug-right {
            display: flex;
            align-items: center;
        }

        .debug-label {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-foreground);
        }

        .debug-buttons {
            display: flex;
            gap: 4px;
        }

        .env-label {
            font-size: 14px;
        }

        .python-path-input-header {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 3px;
            font-size: 12px;
            flex: 1;
            min-width: 200px;
            max-width: 400px;
            font-family: var(--vscode-editor-font-family);
        }

        .python-path-input-header:focus {
            border-color: var(--vscode-focusBorder);
            outline: none;
        }

        .python-path-input-header:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background-color: var(--vscode-input-background);
        }

        /* Debug Info Row (shown when active) */
        .debug-info-row {
            display: none;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }

        .debug-info-row.visible {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .env-separator {
            color: var(--vscode-panel-border);
        }

        .port-info {
            color: var(--vscode-descriptionForeground);
        }

        .current-node {
            color: var(--vscode-foreground);
        }

        .current-node strong {
            color: var(--vscode-textLink-foreground);
        }

        .debug-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .debug-status.stopped {
            background-color: var(--vscode-statusBarItem-errorBackground, #6c2022);
            color: var(--vscode-statusBarItem-errorForeground, #fff);
        }

        .debug-status.running {
            background-color: var(--vscode-statusBarItem-prominentBackground, #388a34);
            color: var(--vscode-statusBarItem-prominentForeground, #fff);
        }

        .debug-status.paused {
            background-color: var(--vscode-statusBarItem-warningBackground, #c9a700);
            color: var(--vscode-statusBarItem-warningForeground, #000);
        }

        .debug-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: currentColor;
        }

        .debug-status.running .debug-status-dot {
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }

        .debug-controls {
            display: flex;
            gap: 8px;
        }

        .debug-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 4px;
            font-size: 16px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .debug-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .debug-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .debug-btn.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .debug-btn.danger {
            background-color: var(--vscode-statusBarItem-errorBackground, #6c2022);
            color: #fff;
        }

        /* Execution Log Panel */
        #executionLog {
            position: absolute;
            bottom: 60px;
            left: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            width: 350px;
            max-height: 300px;
            display: none;
            flex-direction: column;
        }

        #executionLog.visible {
            display: flex;
        }

        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            cursor: pointer;
        }

        .log-header h4 {
            margin: 0;
            font-size: 12px;
        }

        .log-content {
            flex: 1;
            overflow-y: auto;
            max-height: 250px;
            padding: 8px 0;
        }

        .log-entry {
            padding: 4px 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .log-entry:last-child {
            border-bottom: none;
        }

        .log-entry.node_start {
            color: var(--vscode-charts-green, #4CAF50);
        }

        .log-entry.node_end {
            color: var(--vscode-charts-blue, #2196F3);
        }

        .log-entry.error {
            color: var(--vscode-errorForeground, #F44336);
        }

        .log-entry.info {
            color: var(--vscode-descriptionForeground);
        }

        .log-timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-right: 8px;
        }

        /* Live State Panel */
        #liveStatePanel {
            position: absolute;
            top: 60px;
            right: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            font-size: 12px;
            z-index: 1001;
            backdrop-filter: blur(10px);
            min-width: 280px;
            max-width: 400px;
            max-height: 300px;
            display: none;
            flex-direction: column;
        }

        #liveStatePanel.visible {
            display: flex;
        }

        .live-state-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }

        .live-state-header h4 {
            margin: 0;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .live-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #4CAF50;
            animation: pulse 1.5s infinite;
        }

        .live-state-content {
            flex: 1;
            overflow-y: auto;
            padding: 8px 12px;
            font-family: var(--vscode-editor-font-family);
        }

        .live-state-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            font-size: 11px;
        }

        /* Node running animation - bright pulsing effect */
        .node-running {
            animation: nodeRunning 0.8s ease-in-out infinite !important;
            box-shadow: 0 0 20px 10px #FFD700 !important;
        }

        @keyframes nodeRunning {
            0%, 100% {
                box-shadow: 0 0 10px 5px rgba(76, 175, 80, 0.5);
            }
            50% {
                box-shadow: 0 0 20px 10px rgba(76, 175, 80, 0.8);
            }
        }

        /* Breakpoint indicator */
        .breakpoint {
            border: 3px solid #F44336 !important;
        }

        .breakpoint::before {
            content: '🔴';
            position: absolute;
            top: -5px;
            right: -5px;
            font-size: 10px;
        }

        /* Input/Output Panel */
        #ioPanel {
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            font-size: 12px;
            z-index: 1001;
            backdrop-filter: blur(10px);
            min-width: 280px;
            max-width: 400px;
            display: none;
            flex-direction: column;
        }

        #ioPanel.visible {
            display: flex;
        }

        .io-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }

        .io-header h4 {
            margin: 0;
            font-size: 12px;
        }

        .io-tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .io-tab {
            flex: 1;
            padding: 8px;
            text-align: center;
            cursor: pointer;
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            font-size: 11px;
        }

        .io-tab.active {
            background-color: var(--vscode-editor-background);
            border-bottom: 2px solid var(--vscode-button-background);
        }

        .io-content {
            padding: 8px 12px;
            max-height: 200px;
            overflow-y: auto;
            font-family: var(--vscode-editor-font-family);
        }

        .io-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div id="header">
        <div style="display: flex; align-items: center; gap: 15px;">
            <h1>LangGraph Visualization</h1>
            <span class="graph-type-badge">${graphData.graphType}</span>
        </div>
        <div id="controls">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search nodes...">
                <span class="search-icon">🔍</span>
            </div>
            <div class="control-group">
                <button id="fitBtn" title="Fit graph to screen">Fit to Screen</button>
                <button id="resetBtn" title="Reset layout">Reset Layout</button>
                <button id="exportBtn" title="Export as PNG">Export PNG</button>
            </div>
            <div id="stats">
                <div class="stat">
                    <span>Nodes:</span>
                    <span class="stat-value" id="nodeCount">0</span>
                </div>
                <div class="stat">
                    <span>Edges:</span>
                    <span class="stat-value" id="edgeCount">0</span>
                </div>
                <div class="stat">
                    <span>Files:</span>
                    <span class="stat-value" id="fileCount">1</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Debug Controls Bar (separate line) -->
    <div id="debugControlsBar" class="debug-controls-bar">
        <div class="debug-controls-content">
            <div class="debug-left">
                <span class="debug-label">🔬 Debug</span>
                <span class="env-label">🐍</span>
                <input type="text" id="pythonPathInput" class="python-path-input-header" placeholder="python or /path/to/venv/bin/python" value="python" title="Enter Python interpreter path">
            </div>
            <div class="debug-center">
                <span class="debug-status stopped" id="debugStatus">
                    <span class="debug-status-dot"></span>
                    <span id="debugStatusText">Ready</span>
                </span>
            </div>
            <div class="debug-right">
                <div class="debug-buttons">
                    <button class="debug-btn primary" id="debugStartBtn" title="Start Debug Session">▶ Start</button>
                    <button class="debug-btn danger" id="debugStopBtn" title="Stop" disabled>⏹ Stop</button>
                </div>
            </div>
        </div>
        <!-- Debug Info (shown when active) -->
        <div id="debugInfoRow" class="debug-info-row">
            <span id="debugPort" class="port-info">Port: -</span>
            <span class="env-separator">|</span>
            <span id="debugCurrentNode" class="current-node">Node: <strong>-</strong></span>
        </div>
    </div>
    
    <div id="cy">
        <!-- Input/Output Panel -->
        <div id="ioPanel">
            <div class="io-header">
                <h4>📥 Input / Output</h4>
                <button class="copy-state-btn" id="copyIOBtn" title="Copy">📋</button>
            </div>
            <div class="io-tabs">
                <button class="io-tab active" data-tab="input">Input</button>
                <button class="io-tab" data-tab="output">Output</button>
            </div>
            <div class="io-content">
                <pre id="ioContent">No data yet</pre>
            </div>
        </div>

        <!-- Live State Panel -->
        <div id="liveStatePanel">
            <div class="live-state-header">
                <h4><span class="live-indicator"></span> Live State</h4>
            </div>
            <div class="live-state-content">
                <pre id="liveStateContent">Waiting for execution...</pre>
            </div>
        </div>

        <!-- Execution Log -->
        <div id="executionLog">
            <div class="log-header">
                <h4>📜 Execution Log</h4>
                <button class="copy-state-btn" id="clearLogBtn" title="Clear Log">🗑️</button>
            </div>
            <div class="log-content" id="logContent">
                <div class="log-entry info">Waiting for debug session...</div>
            </div>
        </div>

        <div id="statePanel" class="${graphData.state && graphData.state.length > 0 ? '' : 'hidden'}">
            <div class="state-header" id="statePanelHeader">
                <h3>
                    <span>State</span>
                    ${graphData.stateType ? '<span class="state-type-badge">' + graphData.stateType + '</span>' : ''}
                </h3>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="copy-state-btn" id="copyStateBtn" title="Copy state JSON to clipboard">
                        📋
                    </button>
                    <span class="collapse-icon">▼</span>
                </div>
            </div>
            <div class="state-content">
                ${graphData.state && graphData.state.length > 0 ?
                graphData.state.map(field => {
                    const exampleValue = this.getExampleValue(field);
                    return `
                        <div class="state-field" data-field-name="${field.name}" data-field-type="${field.type}">
                            <div class="state-field-header">
                                <div class="state-field-name">${field.name}</div>
                            </div>
                            <div class="state-field-type">${field.type}</div>
                            ${field.defaultValue ?
                            '<div class="state-field-value">' + field.defaultValue + '</div>' :
                            '<div class="state-field-value">' + exampleValue + '</div>'
                        }
                            ${field.annotation ? '<div class="state-field-annotation">⚙️ ' + field.annotation + '</div>' : ''}
                        </div>
                    `;
                }).join('')
                : '<div class="no-state-message">No state fields defined</div>'
            }
            </div>
        </div>
        
        <div id="legend">
            <h3>Legend</h3>
            <div class="legend-item">
                <div class="legend-color start"></div>
                <span>Start Node</span>
            </div>
            <div class="legend-item">
                <div class="legend-color node"></div>
                <span>Regular Node</span>
            </div>
            <div class="legend-item">
                <div class="legend-color end"></div>
                <span>End Node</span>
            </div>
            <div class="legend-item">
                <div class="legend-color tool"></div>
                <span>Tool Node</span>
            </div>
            <div class="legend-item">
                <div class="legend-color agent"></div>
                <span>Agent Node</span>
            </div>
            <div class="legend-item">
                <div class="legend-color direct"></div>
                <span>Direct Edge</span>
            </div>
            <div class="legend-item">
                <div class="legend-color conditional"></div>
                <span>Conditional Edge</span>
            </div>
            <div class="legend-item">
                <div class="legend-color bidirectional"></div>
                <span>Agent-Tool Edge</span>
            </div>
            <div class="legend-item">
                <div class="legend-color subgraph-entry"></div>
                <span>Subgraph Entry</span>
            </div>
            <div class="legend-item">
                <div class="legend-color subgraph-exit"></div>
                <span>Subgraph Exit</span>
            </div>
            <div class="legend-item">
                <div class="legend-color main-graph-parent"></div>
                <span>Main Graph Container</span>
            </div>
            <div class="legend-item">
                <div class="legend-color subgraph-parent"></div>
                <span>Subgraph Container</span>
            </div>
        </div>
        
        <div id="nodeInfo">
            <h3>
                <span id="nodeInfoName"></span>
                <span id="nodeInfoBadge" class="node-badge"></span>
            </h3>
            <div class="info-row">
                <span class="info-label">Function:</span>
                <span class="info-value" id="nodeInfoFunction">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">Line:</span>
                <span class="info-value" id="nodeInfoLine">-</span>
            </div>
            <div class="info-row">
                <span class="info-label">File:</span>
                <span class="info-value" id="nodeInfoFile">-</span>
            </div>
            <div class="info-row" id="nodeInfoToolsRow" style="display: none;">
                <span class="info-label">Tools:</span>
                <span class="info-value" id="nodeInfoTools">-</span>
            </div>
            <button class="jump-button" id="jumpToCodeBtn">Jump to Code</button>
        </div>
        
        <div id="helpText">
            <div class="help-icon">📊</div>
            <div>
                <strong>Interactive Graph Controls</strong><br>
                Drag nodes • Zoom with mouse wheel • Click for details • Search to filter
            </div>
        </div>
        
        <div class="zoom-controls">
            <button class="zoom-button" id="zoomInBtn" title="Zoom In">+</button>
            <button class="zoom-button" id="zoomOutBtn" title="Zoom Out">−</button>
            <button class="zoom-button" id="centerBtn" title="Center">⊙</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Debug state tracking
        let debugState = {
            isActive: false,
            executionState: 'stopped',
            currentNode: null,
            currentState: null,
            initialInput: null,
            finalOutput: null,
            breakpoints: [],
            port: 0,
            pythonPath: 'python'
        };
        let currentIOTab = 'input';
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showReloadToast':
                    const toast = document.getElementById('reloadToast');
                    if (toast) {
                        toast.classList.add('show');
                        // Auto-hide after 2 seconds
                        setTimeout(() => {
                            toast.classList.remove('show');
                        }, 2000);
                    }
                    break;
                case 'clipboardCopySuccess':
                    const copyToast = document.getElementById('copyToast');
                    if (copyToast) {
                        copyToast.classList.add('show');
                        setTimeout(() => {
                            copyToast.classList.remove('show');
                        }, 2000);
                    }
                    break;
                case 'clipboardCopyError':
                    alert('Failed to copy state to clipboard: ' + (message.error || 'Unknown error'));
                    break;
                    
                // Debug state updates
                case 'debugStateUpdate':
                    debugState = message.state;
                    updateDebugUI();
                    break;
                    
                case 'nodeExecutionUpdate':
                    updateNodeExecution(message.nodeExecution);
                    break;
                    
                case 'addLogEntry':
                    addLogEntryToUI(message.logEntry);
                    break;
            }
        });
        
        // Update debug UI based on state
        function updateDebugUI() {
            const debugInfoRow = document.getElementById('debugInfoRow');
            const debugStatus = document.getElementById('debugStatus');
            const debugStatusText = document.getElementById('debugStatusText');
            const debugPort = document.getElementById('debugPort');
            const debugCurrentNode = document.getElementById('debugCurrentNode');
            const executionLog = document.getElementById('executionLog');
            const liveStatePanel = document.getElementById('liveStatePanel');
            const ioPanel = document.getElementById('ioPanel');
            const pythonPathInput = document.getElementById('pythonPathInput');
            const debugStartBtn = document.getElementById('debugStartBtn');
            
            // Show/hide debug info row and panels, disable input while running
            if (debugState.isActive) {
                debugInfoRow.classList.add('visible');
                executionLog.classList.add('visible');
                debugStartBtn.textContent = '▶ Running';
                debugStartBtn.disabled = true;
                pythonPathInput.disabled = true;
                pythonPathInput.title = 'Stop debug session to change Python path';
            } else {
                debugInfoRow.classList.remove('visible');
                executionLog.classList.remove('visible');
                liveStatePanel.classList.remove('visible');
                ioPanel.classList.remove('visible');
                debugStartBtn.textContent = '▶ Start';
                debugStartBtn.disabled = false;
                pythonPathInput.disabled = false;
                pythonPathInput.title = 'Enter Python interpreter path';
            }
            
            // Update status
            debugStatus.className = 'debug-status ' + debugState.executionState;
            const statusLabels = {
                'stopped': 'Ready',
                'running': 'Running',
                'paused': 'Paused',
                'stepping': 'Stepping'
            };
            debugStatusText.textContent = statusLabels[debugState.executionState] || debugState.executionState;
            
            // Update port
            if (debugState.port) {
                debugPort.textContent = 'Port: ' + debugState.port;
            } else {
                debugPort.textContent = 'Port: -';
            }
            
            // Update current node
            if (debugState.currentNode) {
                debugCurrentNode.innerHTML = 'Node: <strong>' + debugState.currentNode + '</strong>';
                highlightCurrentNode(debugState.currentNode);
            } else {
                debugCurrentNode.innerHTML = 'Node: <strong>-</strong>';
                clearNodeHighlight();
            }
            
            // Update buttons
            document.getElementById('debugStopBtn').disabled = !debugState.isActive;
            
            // Update live state panel
            if (debugState.currentState) {
                liveStatePanel.classList.add('visible');
                document.getElementById('liveStateContent').textContent = JSON.stringify(debugState.currentState, null, 2);
                
                // Also update the static state panel with live values
                updateStatePanelWithLiveValues(debugState.currentState);
            }
            
            // Update I/O panel
            if (debugState.initialInput || debugState.finalOutput) {
                ioPanel.classList.add('visible');
                updateIOPanel();
            }
        }
        
        // Highlight current executing node
        function highlightCurrentNode(nodeId) {
            if (typeof cy !== 'undefined' && cy) {
                // Remove previous highlight
                cy.nodes().removeClass('node-running');
                
                // Find and highlight node - try exact match first
                let node = cy.getElementById(nodeId);
                
                // If not found, try case-insensitive match or partial match
                if (node.length === 0) {
                    const lowerNodeId = nodeId.toLowerCase();
                    node = cy.nodes().filter(n => {
                        const id = n.id().toLowerCase();
                        const label = (n.data('label') || '').toLowerCase();
                        return id === lowerNodeId || 
                               label === lowerNodeId ||
                               id.includes(lowerNodeId) || 
                               lowerNodeId.includes(id);
                    });
                }
                
                if (node.length > 0) {
                    node.addClass('node-running');
                    // Pan to node
                    cy.animate({
                        center: { eles: node },
                        duration: 300
                    });
                    console.log('Highlighting node:', nodeId, node.id());
                } else {
                    console.log('Node not found for highlighting:', nodeId);
                }
            }
        }
        
        // Clear node highlight
        function clearNodeHighlight() {
            if (typeof cy !== 'undefined' && cy) {
                cy.nodes().removeClass('node-running');
            }
        }
        
        // Update node execution status
        function updateNodeExecution(nodeExec) {
            if (typeof cy !== 'undefined' && cy) {
                const node = cy.getElementById(nodeExec.nodeId);
                if (node.length > 0) {
                    if (nodeExec.status === 'running') {
                        node.addClass('node-running');
                    } else if (nodeExec.status === 'completed') {
                        node.removeClass('node-running');
                        // Flash green briefly
                        node.style('background-color', '#4CAF50');
                        setTimeout(() => {
                            node.removeStyle('background-color');
                        }, 500);
                    } else if (nodeExec.status === 'error') {
                        node.removeClass('node-running');
                        node.style('background-color', '#F44336');
                    }
                }
            }
        }
        
        // Update state panel with live values
        function updateStatePanelWithLiveValues(liveState) {
            if (!liveState || typeof liveState !== 'object') return;
            
            const statePanel = document.getElementById('statePanel');
            if (!statePanel) return;
            
            // Normalize the state - extract actual state object if it's nested
            let normalizedState = liveState;
            
            // If it's an array, look for an object with expected state keys
            if (Array.isArray(liveState)) {
                for (const item of liveState) {
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        normalizedState = item;
                        break;
                    }
                }
            }
            
            // If state has numeric keys (like '0', '1'), try to find nested state object
            const keys = Object.keys(normalizedState);
            const hasNumericKeys = keys.every(k => /^\\d+$/.test(k));
            if (hasNumericKeys && keys.length > 0) {
                // Look for the first object value that looks like actual state
                for (const value of Object.values(normalizedState)) {
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        const valueKeys = Object.keys(value);
                        // Check if this object has non-numeric keys (actual state fields)
                        if (valueKeys.length > 0 && !valueKeys.every(k => /^\\d+$/.test(k))) {
                            normalizedState = value;
                            break;
                        }
                    }
                }
            }
            
            // Show state panel if hidden
            statePanel.classList.remove('hidden');
            
            // Update each field with its live value
            const stateFields = statePanel.querySelectorAll('.state-field');
            stateFields.forEach(field => {
                const fieldName = field.getAttribute('data-field-name');
                if (fieldName && normalizedState.hasOwnProperty(fieldName)) {
                    const valueDiv = field.querySelector('.state-field-value');
                    if (valueDiv) {
                        const value = normalizedState[fieldName];
                        let displayValue;
                        if (value === null || value === undefined) {
                            displayValue = String(value);
                        } else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value, null, 2);
                        } else {
                            displayValue = String(value);
                        }
                        valueDiv.textContent = displayValue;
                        valueDiv.classList.add('live-value');
                        
                        // Add flash effect
                        valueDiv.classList.add('value-updated');
                        setTimeout(() => valueDiv.classList.remove('value-updated'), 500);
                    }
                }
            });
            
            // Only update existing fields from schema, don't add new ones
        }
        
        // Add log entry to UI
        function addLogEntryToUI(logEntry) {
            const logContent = document.getElementById('logContent');
            const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
            
            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry ' + logEntry.type;
            entryDiv.innerHTML = '<span class="log-timestamp">' + timestamp + '</span>' + logEntry.message;
            
            logContent.appendChild(entryDiv);
            
            // Scroll to bottom
            logContent.scrollTop = logContent.scrollHeight;
            
            // Keep log limited to 100 entries
            while (logContent.children.length > 100) {
                logContent.removeChild(logContent.firstChild);
            }
        }
        
        // Update I/O panel
        function updateIOPanel() {
            const ioContent = document.getElementById('ioContent');
            if (currentIOTab === 'input') {
                ioContent.textContent = debugState.initialInput 
                    ? JSON.stringify(debugState.initialInput, null, 2)
                    : 'No input data';
            } else {
                ioContent.textContent = debugState.finalOutput 
                    ? JSON.stringify(debugState.finalOutput, null, 2)
                    : 'No output yet';
            }
        }
        
        // Graph data
        const cytoscapeElements = ${JSON.stringify(cytoscapeData)};
        
        // Check if Cytoscape is loaded
        if (typeof cytoscape === 'undefined') {
            document.getElementById('helpText').innerHTML = 
                '<div class="help-icon">⚠️</div>' +
                '<div><strong>Loading Error</strong><br>Failed to load Cytoscape.js library. Using fallback visualization.</div>';
            document.getElementById('helpText').classList.remove('hidden');
            
            // Show fallback visualization
            showFallbackVisualization();
        }
        
        // Fallback visualization function
        function showFallbackVisualization() {
            const cyContainer = document.getElementById('cy');
            const nodesHtml = cytoscapeElements.nodes.map(node => 
                '<div style="margin: 5px; padding: 5px; border: 1px solid #ccc; border-radius: 3px; display: inline-block; margin: 2px;">' +
                '<span style="background-color: ' + (node.data.type === 'start' ? '#4CAF50' : node.data.type === 'end' ? '#F44336' : '#2196F3') + '; color: white; padding: 2px 6px; border-radius: 2px; font-size: 12px;">' + node.data.type.toUpperCase() + '</span> ' +
                node.data.label + 
                (node.data.functionName ? '<br><small>Function: ' + node.data.functionName + '</small>' : '') +
                '</div>'
            ).join('');
            
            const edgesHtml = cytoscapeElements.edges.map(edge => 
                '<div style="margin: 5px; padding: 5px; border: 1px solid #ddd; border-radius: 3px; display: inline-block; margin: 2px;">' +
                edge.data.source + ' → ' + edge.data.target +
                (edge.data.label ? '<br><small>Label: ' + edge.data.label + '</small>' : '') +
                '</div>'
            ).join('');
            
            cyContainer.innerHTML = '<div style="padding: 20px; text-align: center;">' +
                '<h3>Fallback Visualization</h3>' +
                '<div style="margin: 20px 0;">' +
                '<strong>Nodes (' + cytoscapeElements.nodes.length + '):</strong><br>' +
                nodesHtml +
                '</div>' +
                '<div style="margin: 20px 0;">' +
                '<strong>Edges (' + cytoscapeElements.edges.length + '):</strong><br>' +
                edgesHtml +
                '</div>' +
                '</div>';
        }
        
        // Initialize Cytoscape
        let cy;
        try {
            cy = cytoscape({
            container: document.getElementById('cy'),
            elements: cytoscapeElements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#2196F3',
                        'label': 'data(label)',
                        'color': '#ffffff',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '14px',
                        'font-weight': 'bold',
                        'width': '80px',
                        'height': '80px',
                        'border-width': '3px',
                        'border-color': '#1565C0',
                        'text-wrap': 'wrap',
                        'text-max-width': '70px',
                        'transition-property': 'background-color, border-color, width, height',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'node[type="start"]',
                    style: {
                        'background-color': '#4CAF50',
                        'border-color': '#2E7D32'
                    }
                },
                {
                    selector: 'node[type="end"]',
                    style: {
                        'background-color': '#F44336',
                        'border-color': '#C62828'
                    }
                },
                {
                    selector: 'node[type="tool"]',
                    style: {
                        'background-color': '#9C27B0',
                        'border-color': '#6A1B9A',
                        'shape': 'hexagon'
                    }
                },
                {
                    selector: 'node[type="agent"]',
                    style: {
                        'background-color': '#FF9800',
                        'border-color': '#E65100',
                        'shape': 'diamond'
                    }
                },
                {
                    selector: 'node[type="subgraph"]',
                    style: {
                        'background-color': '#e3f2fd',
                        'border-color': '#2196f3',
                        'border-width': '3px',
                        'border-style': 'dashed'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': '5px',
                        'border-color': '#FFC107',
                        'width': '90px',
                        'height': '90px'
                    }
                },
                {
                    selector: 'node:active',
                    style: {
                        'overlay-opacity': 0.2,
                        'overlay-color': '#FFC107'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#2196F3',
                        'target-arrow-color': '#2196F3',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'straight',
                        'arrow-scale': 1.2,
                        'transition-property': 'line-color, target-arrow-color, width',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'edge[type="conditional"]',
                    style: {
                        'line-color': '#FF9800',
                        'target-arrow-color': '#FF9800',
                        'line-style': 'dashed'
                    }
                },
                {
                    selector: 'edge[type="bidirectional"]',
                    style: {
                        'line-color': '#9C27B0',
                        'target-arrow-color': '#9C27B0',
                        'source-arrow-color': '#9C27B0',
                        'source-arrow-shape': 'triangle',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1.0,
                        'curve-style': 'bezier',
                        'label': 'data(label)',
                        'text-rotation': 'autorotate',
                        'font-size': '10px',
                        'color': '#9C27B0',
                        'text-margin-y': -10
                    }
                },
                {
                    selector: 'edge[type="subgraph-entry"]',
                    style: {
                        'line-color': '#4CAF50',
                        'target-arrow-color': '#4CAF50',
                        'line-width': 4,
                        'target-arrow-shape': 'triangle',
                        'target-arrow-size': 10,
                        'curve-style': 'bezier',
                        'control-point-step-size': 100,
                        'control-point-distances': [50, 100],
                        'control-point-weights': [0.25, 0.75],
                        'label': 'data(label)',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -15,
                        'font-size': '12px',
                        'color': '#4CAF50',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'edge[type="subgraph-exit"]',
                    style: {
                        'line-color': '#F44336',
                        'target-arrow-color': '#F44336',
                        'line-width': 4,
                        'target-arrow-shape': 'triangle',
                        'target-arrow-size': 10,
                        'curve-style': 'bezier',
                        'control-point-step-size': 100,
                        'control-point-distances': [50, 100],
                        'control-point-weights': [0.25, 0.75],
                        'label': 'data(label)',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -15,
                        'font-size': '12px',
                        'color': '#F44336',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'width': 5,
                        'line-color': '#FFC107',
                        'target-arrow-color': '#FFC107'
                    }
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': '#FFC107',
                        'border-color': '#FFA000',
                        'line-color': '#FFC107',
                        'target-arrow-color': '#FFC107',
                        'width': '90px',
                        'height': '90px',
                        'transition-duration': '0.3s'
                    }
                },
                {
                    selector: '.dimmed',
                    style: {
                        'opacity': 0.2
                    }
                },
                {
                    selector: 'node[type="subgraph"]',
                    style: {
                        'background-color': '#e3f2fd',
                        'border-color': '#2196f3',
                        'border-width': '3px',
                        'border-style': 'dashed'
                    }
                },
                {
                    selector: 'node[type="subgraph-parent"]',
                    style: {
                        'background-color': '#f0f8ff',
                        'border-color': '#2196f3',
                        'border-width': '3px',
                        'border-style': 'solid',
                        'shape': 'rectangle',
                        'width': 'data(width)',
                        'height': 'data(height)',
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'color': '#2196f3',
                        'font-weight': 'bold',
                        'font-size': '12px',
                        'padding': '10px',
                        'text-wrap': 'wrap',
                        'text-max-width': '200px'
                    }
                },
                {
                    selector: '.subgraph-parent',
                    style: {
                        'background-color': '#f0f8ff',
                        'border-color': '#2196f3',
                        'border-width': '3px',
                        'border-style': 'solid',
                        'shape': 'rectangle'
                    }
                },
                {
                    selector: 'node:parent',
                    style: {
                        'background-opacity': 0.1,
                        'border-opacity': 1,
                        'text-opacity': 1
                    }
                },
                {
                    selector: 'node:parent node',
                    style: {
                        'background-opacity': 1,
                        'border-opacity': 1
                    }
                },
                {
                    selector: 'node[type="main-graph-parent"]',
                    style: {
                        'background-color': '#fff3e0',
                        'border-color': '#ff9800',
                        'border-width': '4px',
                        'border-style': 'solid',
                        'shape': 'rectangle',
                        'width': 'data(width)',
                        'height': 'data(height)',
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'color': '#ff9800',
                        'font-weight': 'bold',
                        'font-size': '14px',
                        'padding': '15px',
                        'text-wrap': 'wrap',
                        'text-max-width': '300px'
                    }
                },
                {
                    selector: '.main-graph-parent',
                    style: {
                        'background-color': '#fff3e0',
                        'border-color': '#ff9800',
                        'border-width': '4px',
                        'border-style': 'solid',
                        'shape': 'rectangle'
                    }
                },
                {
                    selector: '.node-running',
                    style: {
                        'background-color': '#FFD700',
                        'border-color': '#FFA500',
                        'border-width': '6px',
                        'width': '100px',
                        'height': '100px',
                        'font-size': '16px',
                        'overlay-color': '#FFD700',
                        'overlay-opacity': 0.3
                    }
                }
            ],
            layout: {
                name: 'dagre',
                rankDir: 'TB',
                nodeSep: 20,
                rankSep: 40,
                padding: 20,
                edgeSep: 15,
                align: 'UL',
                acyclicer: 'greedy',
                spacingFactor: 1.0
            },
            minZoom: 0.3,
            maxZoom: 3,
            wheelSensitivity: 0.2
        });
        
        
        } catch (error) {
            console.error('Failed to initialize Cytoscape:', error);
            document.getElementById('helpText').innerHTML = 
                '<div class="help-icon">❌</div>' +
                '<div><strong>Initialization Error</strong><br>Failed to create graph visualization: ' + error.message + '</div>';
            document.getElementById('helpText').classList.remove('hidden');
        }
        
        // Check if graph is empty
        if (cytoscapeElements.nodes.length === 0) {
            document.getElementById('helpText').innerHTML = 
                '<div class="help-icon">📝</div>' +
                '<div><strong>No Graph Data</strong><br>No nodes or edges were detected in the current file.</div>';
            document.getElementById('helpText').classList.remove('hidden');
        }
        
        // Hide help text after initial load (only if graph loaded successfully)
        if (cy && cy.nodes().length > 0) {
            setTimeout(() => {
                document.getElementById('helpText').classList.add('hidden');
                // Apply alternating subgraph positioning
                applyAlternatingSubgraphLayout();
            }, 3000);
        }

        // Function to position subgraphs in alternating left-right pattern
        function applyAlternatingSubgraphLayout() {
            if (!cy) return;
            
            const subgraphParents = cy.nodes('[type="subgraph-parent"]');
            
            if (subgraphParents.length === 0) return;
            
            // Get the main graph container bounds
            const mainContainer = cy.nodes('[type="main-graph-parent"]');
            const mainBounds = mainContainer.boundingBox();
            const centerX = mainBounds.x1 + mainBounds.w / 2;
            const topY = mainBounds.y1; // Start from top of main container
            
            // Position subgraphs in alternating pattern starting from top
            subgraphParents.forEach((subgraph, index) => {
                const isLeft = index % 2 === 0;
                const offsetX = isLeft ? -250 : 250; // Left or right offset (increased for better separation)
                const offsetY = Math.floor(index / 2) * 180; // Vertical stacking (increased spacing)
                
                const newX = centerX + offsetX;
                const newY = topY + offsetY; // Start from top, not center
                
                subgraph.position({
                    x: newX,
                    y: newY
                });
            });
            
            // Refresh the layout
            cy.fit(50);
        }
        
        // Node click handler - show details (only if cy is defined)
        let selectedNode = null;
        let selectedNodeData = null; // Store the data separately to prevent it from being lost
        
        if (cy) {
            cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            selectedNode = node;
            selectedNodeData = node.data();
            
            
            document.getElementById('nodeInfoName').textContent = selectedNodeData.label;
            document.getElementById('nodeInfoBadge').textContent = selectedNodeData.type;
            document.getElementById('nodeInfoBadge').className = 'node-badge ' + selectedNodeData.type;
            document.getElementById('nodeInfoFunction').textContent = selectedNodeData.functionName || '-';
            document.getElementById('nodeInfoLine').textContent = selectedNodeData.lineNumber || '-';
            document.getElementById('nodeInfoFile').textContent = selectedNodeData.filePath ? selectedNodeData.filePath.split('/').pop() : '-';
            
            // Show tools information if available
            const toolsRow = document.getElementById('nodeInfoToolsRow');
            const toolsValue = document.getElementById('nodeInfoTools');
            if (selectedNodeData.tools && selectedNodeData.tools.length > 0) {
                toolsValue.textContent = selectedNodeData.tools.join(', ');
                toolsRow.style.display = 'flex';
            } else if (selectedNodeData.toolType) {
                toolsValue.textContent = 'Type: ' + selectedNodeData.toolType;
                toolsRow.style.display = 'flex';
            } else {
                toolsRow.style.display = 'none';
            }
            
            document.getElementById('nodeInfo').classList.add('visible');
        });
        
            // Click on canvas to deselect
            cy.on('tap', function(evt) {
                if (evt.target === cy) {
                    // Don't deselect if we're clicking on UI elements
                    const target = evt.originalEvent.target;
                    if (target && (target.closest('#nodeInfo') || target.closest('button'))) {
                        return;
                    }
                    
                    document.getElementById('nodeInfo').classList.remove('visible');
                    selectedNode = null;
                    selectedNodeData = null;
                }
            });
        
        // Jump to code button
        document.getElementById('jumpToCodeBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Small delay to ensure the button click is processed before any canvas click
            setTimeout(() => {
            if (selectedNodeData) {
                const lineNumber = selectedNodeData.lineNumber;
                const filePath = selectedNodeData.filePath;
                
                if (lineNumber) {
                    vscode.postMessage({
                        command: 'jumpToCode',
                        lineNumber: lineNumber,
                        filePath: filePath
                    });
                } else {
                    alert('No line number available for this node');
                }
            } else if (selectedNode) {
                const lineNumber = selectedNode.data('lineNumber');
                const filePath = selectedNode.data('filePath');
                
                if (lineNumber) {
                    vscode.postMessage({
                        command: 'jumpToCode',
                        lineNumber: lineNumber,
                        filePath: filePath
                    });
                } else {
                    alert('No line number available for this node');
                }
            } else {
                alert('Please select a node first by clicking on it in the graph');
            }
            }, 10); // Small delay to prevent race condition
        });
        
            // Search functionality
            let searchTimeout;
            document.getElementById('searchInput').addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = e.target.value.toLowerCase();
                    
                    if (searchTerm === '') {
                        cy.elements().removeClass('highlighted dimmed');
                    } else {
                        const matches = cy.nodes().filter(node => 
                            node.data('label').toLowerCase().includes(searchTerm) ||
                            (node.data('functionName') || '').toLowerCase().includes(searchTerm)
                        );
                        
                        if (matches.length > 0) {
                            cy.elements().addClass('dimmed');
                            matches.removeClass('dimmed').addClass('highlighted');
                            
                            // Fit to matched nodes
                            cy.fit(matches, 100);
                        } else {
                            cy.elements().removeClass('highlighted dimmed');
                        }
                    }
                }, 300);
            });
        
            // Fit to screen
            document.getElementById('fitBtn').addEventListener('click', () => {
                if (cy) {
                    cy.fit(50);
                    cy.elements().removeClass('highlighted dimmed');
                    document.getElementById('searchInput').value = '';
                }
            });
        
            // Reset layout
            document.getElementById('resetBtn').addEventListener('click', () => {
                if (cy) {
                    cy.layout({
                        name: 'dagre',
                        rankDir: 'TB',
                        nodeSep: 20,
                        rankSep: 40,
                        padding: 20,
                        edgeSep: 15,
                        align: 'UL',
                        acyclicer: 'greedy',
                        spacingFactor: 1.0
                    }).run();
                    
                    // Apply alternating subgraph positioning after layout
                    setTimeout(() => {
                        applyAlternatingSubgraphLayout();
                    }, 100);
                }
            });
        
            // Export as PNG
            document.getElementById('exportBtn').addEventListener('click', () => {
                if (cy) {
                    const png = cy.png({
                        full: true,
                        scale: 2,
                        bg: getComputedStyle(document.body).backgroundColor
                    });
                    
                    const link = document.createElement('a');
                    link.href = png;
                    link.download = 'langgraph-visualization.png';
                    link.click();
                }
            });
        
            // Zoom controls
            document.getElementById('zoomInBtn').addEventListener('click', () => {
                if (cy) {
                    cy.zoom(cy.zoom() * 1.2);
                    cy.center();
                }
            });
            
            document.getElementById('zoomOutBtn').addEventListener('click', () => {
                if (cy) {
                    cy.zoom(cy.zoom() * 0.8);
                    cy.center();
                }
            });
            
            document.getElementById('centerBtn').addEventListener('click', () => {
                if (cy) {
                    cy.fit(50);
                }
            });
        
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
                if (e.key === 'Escape') {
                    document.getElementById('searchInput').value = '';
                    if (cy) {
                        cy.elements().removeClass('highlighted dimmed');
                    }
                    document.getElementById('nodeInfo').classList.remove('visible');
                }
            });
        
            // Hover effects
            cy.on('mouseover', 'node', function(evt) {
                document.body.style.cursor = 'pointer';
            });
            
            cy.on('mouseout', 'node', function(evt) {
                document.body.style.cursor = 'default';
            });
            
            // Update statistics
            function updateStats() {
                document.getElementById('nodeCount').textContent = cy.nodes().length;
                document.getElementById('edgeCount').textContent = cy.edges().length;
                
                // Count unique files
                const files = new Set();
                cy.nodes().forEach(node => {
                    if (node.data('filePath')) {
                        files.add(node.data('filePath'));
                    }
                });
                document.getElementById('fileCount').textContent = files.size;
            }

            // Initial stats update
            cy.ready(() => {
                updateStats();
            });
        }

        // State panel collapse/expand functionality
        const statePanel = document.getElementById('statePanel');
        const statePanelHeader = document.getElementById('statePanelHeader');
        
        if (statePanel && statePanelHeader) {
            statePanelHeader.addEventListener('click', (e) => {
                // Don't collapse if clicking the copy button
                if (e.target.id !== 'copyStateBtn' && !e.target.closest('#copyStateBtn')) {
                    statePanel.classList.toggle('collapsed');
                }
            });
        }

        // Debug button event listeners
        document.getElementById('debugStartBtn')?.addEventListener('click', () => {
            // Get python path from input before starting
            const pythonPathInput = document.getElementById('pythonPathInput');
            const pythonPath = pythonPathInput ? pythonPathInput.value.trim() || 'python' : 'python';
            vscode.postMessage({ command: 'debugStart', pythonPath: pythonPath });
        });
        
        document.getElementById('debugStopBtn')?.addEventListener('click', () => {
            vscode.postMessage({ command: 'debugStop' });
        });
        
        // Enter key on python path input starts debug
        document.getElementById('pythonPathInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !debugState.isActive) {
                const pythonPath = e.target.value.trim() || 'python';
                vscode.postMessage({ command: 'debugStart', pythonPath: pythonPath });
            }
        });
        
        // Clear log button
        document.getElementById('clearLogBtn')?.addEventListener('click', () => {
            const logContent = document.getElementById('logContent');
            if (logContent) {
                logContent.innerHTML = '<div class="log-entry info">Log cleared</div>';
            }
        });
        
        // I/O tab switching
        document.querySelectorAll('.io-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.io-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                currentIOTab = e.target.getAttribute('data-tab');
                updateIOPanel();
            });
        });
        
        // Double-click on node to toggle breakpoint
        if (typeof cy !== 'undefined' && cy) {
            cy.on('dbltap', 'node', function(evt) {
                const nodeId = evt.target.id();
                vscode.postMessage({ command: 'toggleBreakpoint', nodeId: nodeId });
                
                // Visual feedback
                const node = evt.target;
                if (node.hasClass('breakpoint')) {
                    node.removeClass('breakpoint');
                } else {
                    node.addClass('breakpoint');
                }
            });
        }

        // Copy state to clipboard functionality
        const copyStateBtn = document.getElementById('copyStateBtn');
        
        if (copyStateBtn) {
            copyStateBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent panel collapse
                
                // Collect state fields from the DOM
                const stateFields = document.querySelectorAll('.state-field');
                const stateObject = {};
                
                stateFields.forEach(field => {
                    const name = field.getAttribute('data-field-name');
                    const valueElement = field.querySelector('.state-field-value');
                    
                    if (name && valueElement) {
                        const valueText = valueElement.textContent.trim();
                        
                        // Try to parse the value as JSON
                        try {
                            // Remove quotes for strings to get raw value
                            if (valueText === '""') {
                                stateObject[name] = "";
                            } else if (valueText === 'null') {
                                stateObject[name] = null;
                            } else if (valueText === 'false') {
                                stateObject[name] = false;
                            } else if (valueText === 'true') {
                                stateObject[name] = true;
                            } else if (valueText === '[]') {
                                stateObject[name] = [];
                            } else if (valueText === '{}') {
                                stateObject[name] = {};
                            } else if (!isNaN(valueText) && valueText !== '') {
                                stateObject[name] = Number(valueText);
                            } else {
                                stateObject[name] = valueText;
                            }
                        } catch (error) {
                            stateObject[name] = valueText;
                        }
                    }
                });
                
                // Copy to clipboard via VS Code API
                const stateJSON = JSON.stringify(stateObject, null, 2);
                
                // Send message to extension to copy to clipboard
                vscode.postMessage({
                    command: 'copyToClipboard',
                    text: stateJSON
                });
            });
        }
        
    </script>
    
    <!-- Auto-reload toast notification -->
    <div id="reloadToast">
        <svg class="reload-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
            <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
        </svg>
        <span>Graph reloading...</span>
    </div>

    <!-- Copy state toast notification -->
    <div id="copyToast" class="copy-toast">
        <span class="copy-toast-icon">✓</span>
        <span>State JSON copied to clipboard!</span>
    </div>
    
</body>
</html>`;
    }

    /**
     * Convert graph structure to Cytoscape format with flattened subgraphs
     */
    private static convertToCytoscapeFormat(graphData: GraphStructure): any {
        const nodes: any[] = [];
        const edges: any[] = [];

        // Add main graph container
        const mainGraphId = 'main_graph_container';
        nodes.push({
            data: {
                id: mainGraphId,
                label: 'Main Graph: ' + graphData.graphType,
                type: 'main-graph-parent',
                width: 400,
                height: 300
            },
            classes: 'main-graph-parent'
        });

        // Add all nodes from main graph and subgraphs with main graph as parent
        this.processGraphRecursively(graphData, nodes, edges, '', mainGraphId);

        return { nodes, edges };
    }

    /**
     * Recursively process graph and subgraphs to create flat structure
     */
    private static processGraphRecursively(
        graph: GraphStructure,
        nodes: any[],
        edges: any[],
        prefix: string,
        parentId?: string
    ): void {
        // Add main graph nodes
        graph.nodes.forEach(node => {
            const nodeId = prefix + node.id;
            const nodeData: any = {
                id: nodeId,
                label: node.label,
                type: node.type,
                functionName: node.functionName,
                lineNumber: node.lineNumber,
                filePath: node.filePath || graph.filePath,
                tools: node.tools,           // NEW: Include tools data
                toolType: node.toolType      // NEW: Include toolType data
            };

            // If this is a child node, set the parent
            if (parentId) {
                nodeData.parent = parentId;
            }

            nodes.push({
                data: nodeData
            });

            // If node has subgraph, create a compound node (parent) and add subgraph nodes as children
            if (node.subgraph) {
                // Add the parent compound node (the rectangle box)
                const parentId = nodeId + '_parent';
                nodes.push({
                    data: {
                        id: parentId,
                        label: node.label + ' Subgraph',
                        type: 'subgraph-parent',
                        width: 300,
                        height: 200
                    },
                    classes: 'subgraph-parent'
                });

                // Ensure subgraph nodes inherit the correct file path and set parent
                const subgraphWithFilePath = {
                    ...node.subgraph,
                    filePath: node.subgraph.filePath || node.filePath
                };
                this.processGraphRecursively(subgraphWithFilePath, nodes, edges, nodeId + '_', parentId);

                // Add arrows: main node -> subgraph start and subgraph end -> next main node
                this.addSubgraphArrows(node, nodeId, parentId, edges, graph.nodes);
            }
        });

        // Add main graph edges (but skip edges from nodes that have subgraphs)
        graph.edges.forEach(edge => {
            const sourceId = prefix + edge.from;
            const targetId = prefix + edge.to;

            // Check if the source node has a subgraph
            const sourceNode = graph.nodes.find(node => node.id === edge.from);
            if (sourceNode && sourceNode.subgraph) {
                // Skip this edge - the flow will go through the subgraph instead
                return;
            }

            edges.push({
                data: {
                    id: prefix + edge.from + '_to_' + edge.to,
                    source: sourceId,
                    target: targetId,
                    type: edge.type,
                    label: edge.label
                }
            });
        });

        // Add subgraph edges
        graph.nodes.forEach(node => {
            if (node.subgraph) {
                node.subgraph.edges.forEach(subEdge => {
                    const sourceId = prefix + node.id + '_' + subEdge.from;
                    const targetId = prefix + node.id + '_' + subEdge.to;

                    edges.push({
                        data: {
                            id: prefix + node.id + '_' + subEdge.from + '_to_' + subEdge.to,
                            source: sourceId,
                            target: targetId,
                            type: subEdge.type,
                            label: subEdge.label
                        }
                    });
                });
            }
        });
    }

    /**
     * Get example value based on field type
     */
    private static getExampleValue(field: any): string {
        const type = field.type.toLowerCase();

        // Handle default values
        if (field.defaultValue) {
            return field.defaultValue;
        }

        // Generate example values based on type
        if (type.includes('str')) {
            return '""';
        } else if (type.includes('int')) {
            return '0';
        } else if (type.includes('float')) {
            return '0.0';
        } else if (type.includes('bool')) {
            return 'false';
        } else if (type.includes('list') || type.includes('sequence')) {
            return '[]';
        } else if (type.includes('dict') || type.includes('mapping')) {
            return '{}';
        } else if (type.includes('tuple')) {
            return '()';
        } else if (type.includes('set')) {
            return 'set()';
        } else if (type.includes('none')) {
            return 'null';
        } else {
            return 'null';
        }
    }

    /**
     * Add arrows between main graph nodes and subgraphs
     */
    private static addSubgraphArrows(
        node: any,
        nodeId: string,
        parentId: string,
        edges: any[],
        allNodes: any[]
    ): void {
        // Find the subgraph start and end nodes
        const subgraphStart = node.subgraph.nodes.find((n: any) => n.type === 'start');
        const subgraphEnd = node.subgraph.nodes.find((n: any) => n.type === 'end');

        if (subgraphStart) {
            // Arrow from main node to subgraph start
            const subgraphStartId = nodeId + '_' + subgraphStart.id;
            edges.push({
                data: {
                    id: nodeId + '_to_' + subgraphStartId,
                    source: nodeId,
                    target: subgraphStartId,
                    type: 'subgraph-entry',
                    label: '→ Subgraph'
                }
            });
        }

        if (subgraphEnd) {
            // Find the next main graph node after this one
            const currentNodeIndex = allNodes.findIndex(n => n.id === node.id);
            const nextNode = allNodes[currentNodeIndex + 1];

            if (nextNode) {
                // Arrow from subgraph end to next main node
                const subgraphEndId = nodeId + '_' + subgraphEnd.id;
                const nextNodeId = nextNode.id; // No prefix for main graph nodes

                edges.push({
                    data: {
                        id: subgraphEndId + '_to_' + nextNodeId,
                        source: subgraphEndId,
                        target: nextNodeId,
                        type: 'subgraph-exit',
                        label: 'Subgraph →'
                    }
                });
            }
        }
    }
}