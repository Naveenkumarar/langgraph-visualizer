import * as vscode from 'vscode';
import { GraphStructure } from './graphParser';

/**
 * Provides webview panel for graph visualization
 */
export class WebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentDocument: vscode.TextDocument | undefined;

    /**
     * Show the graph visualization in a webview panel
     */
    public static show(context: vscode.ExtensionContext, graphData: GraphStructure, document: vscode.TextDocument): void {
        WebviewProvider.currentDocument = document;
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.reveal(column);
            WebviewProvider.currentPanel.webview.html = this.getWebviewContent(graphData);
        } else {
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
                    }
                },
                undefined,
                context.subscriptions
            );

            panel.onDidDispose(() => {
                WebviewProvider.currentPanel = undefined;
            }, null, context.subscriptions);
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
            top: 10px;
            right: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 12px;
            font-size: 12px;
            z-index: 1000;
            backdrop-filter: blur(10px);
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
    
    <div id="cy">
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
                <div class="legend-color direct"></div>
                <span>Direct Edge</span>
            </div>
            <div class="legend-item">
                <div class="legend-color conditional"></div>
                <span>Conditional Edge</span>
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
                        'width': 3,
                        'line-color': '#2196F3',
                        'target-arrow-color': '#2196F3',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.5,
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
                }
            ],
            layout: {
                name: 'dagre',
                rankDir: 'TB',
                nodeSep: 50,
                rankSep: 100,
                padding: 50
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
            }, 3000);
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
                        nodeSep: 50,
                        rankSep: 100,
                        padding: 50
                    }).run();
                    cy.fit(50);
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
        
    </script>
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
                filePath: node.filePath || graph.filePath
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
            }
        });

        // Add main graph edges
        graph.edges.forEach(edge => {
            const sourceId = prefix + edge.from;
            const targetId = prefix + edge.to;

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
}