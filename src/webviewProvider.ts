import * as vscode from 'vscode';
import { GraphStructure } from './graphParser';

/**
 * Provides webview panel for graph visualization
 */
export class WebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;

    /**
     * Show the graph visualization in a webview panel
     */
    public static show(context: vscode.ExtensionContext, graphData: GraphStructure): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (WebviewProvider.currentPanel) {
            WebviewProvider.currentPanel.reveal(column);
            WebviewProvider.currentPanel.webview.html = this.getWebviewContent(graphData);
            return;
        }

        // Otherwise, create a new panel
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

        // Set the webview's content
        panel.webview.html = this.getWebviewContent(graphData);

        // Reset when the current panel is closed
        panel.onDidDispose(
            () => {
                WebviewProvider.currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    }

    /**
     * Generate HTML content for the webview
     */
    private static getWebviewContent(graphData: GraphStructure): string {
        const nodesHtml = graphData.nodes.map(node => {
            const nodeClass = node.type === 'start' ? 'node-start' :
                node.type === 'end' ? 'node-end' : 'node-regular';
            return `<div class="node ${nodeClass}">
                <div class="node-label">${this.escapeHtml(node.label)}</div>
                <div class="node-type">${node.type}</div>
            </div>`;
        }).join('');

        const edgesHtml = graphData.edges.map(edge => {
            const edgeClass = edge.type === 'conditional' ? 'edge-conditional' : 'edge-direct';
            const label = edge.label ? ` (${this.escapeHtml(edge.label)})` : '';
            return `<div class="edge ${edgeClass}">
                <span class="edge-from">${this.escapeHtml(edge.from)}</span>
                <span class="edge-arrow">→</span>
                <span class="edge-to">${this.escapeHtml(edge.to)}</span>
                ${label ? `<span class="edge-label">${label}</span>` : ''}
            </div>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LangGraph Visualization</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        h2 {
            color: var(--vscode-foreground);
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        .graph-type {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.9em;
            display: inline-block;
            margin-bottom: 20px;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .nodes-container, .edges-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .node {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s;
        }
        
        .node:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .node-label {
            font-weight: 600;
            font-size: 1.1em;
        }
        
        .node-type {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        
        .node-start {
            border-left: 4px solid #4CAF50;
        }
        
        .node-end {
            border-left: 4px solid #F44336;
        }
        
        .node-regular {
            border-left: 4px solid #2196F3;
        }
        
        .edge {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background-color 0.2s;
        }
        
        .edge:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .edge-from, .edge-to {
            font-weight: 500;
        }
        
        .edge-arrow {
            color: var(--vscode-descriptionForeground);
            font-size: 1.2em;
        }
        
        .edge-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            font-style: italic;
        }
        
        .edge-conditional {
            border-left: 4px solid #FF9800;
        }
        
        .edge-direct {
            border-left: 4px solid #2196F3;
        }
        
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .stat-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 10px 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .stat-label {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
        }
        
        .stat-value {
            font-size: 1.5em;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .note {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin-top: 30px;
            border-radius: 3px;
        }
        
        .note-title {
            font-weight: 600;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <h1>LangGraph Visualization</h1>
    
    <div class="graph-type">Graph Type: ${this.escapeHtml(graphData.graphType)}</div>
    
    <div class="stats">
        <div class="stat-item">
            <div class="stat-label">Nodes</div>
            <div class="stat-value">${graphData.nodes.length}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Edges</div>
            <div class="stat-value">${graphData.edges.length}</div>
        </div>
    </div>
    
    <div class="section">
        <h2>Nodes</h2>
        <div class="nodes-container">
            ${graphData.nodes.length > 0 ? nodesHtml : '<div class="empty-state">No nodes found</div>'}
        </div>
    </div>
    
    <div class="section">
        <h2>Edges</h2>
        <div class="edges-container">
            ${graphData.edges.length > 0 ? edgesHtml : '<div class="empty-state">No edges found</div>'}
        </div>
    </div>
    
    <div class="note">
        <div class="note-title">Note</div>
        <div>This is a basic text-based visualization. Future versions will include graphical graph visualization.</div>
    </div>
</body>
</html>`;
    }

    /**
     * Escape HTML special characters
     */
    private static escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

