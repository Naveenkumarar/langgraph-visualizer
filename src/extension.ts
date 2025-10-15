import * as vscode from 'vscode';
import { GraphDetector } from './graphDetector';
import { GraphParser } from './graphParser';
import { WebviewProvider } from './webviewProvider';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('LangGraph Visualizer extension is now active');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'langgraph-visualizer.showGraph';
    statusBarItem.text = '$(graph) LangGraph';
    statusBarItem.tooltip = 'Show LangGraph Visualization';
    context.subscriptions.push(statusBarItem);

    // Register the show graph command
    const showGraphCommand = vscode.commands.registerCommand(
        'langgraph-visualizer.showGraph',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const document = editor.document;
            if (!GraphDetector.hasLangGraph(document)) {
                vscode.window.showWarningMessage(
                    'No LangGraph code detected in the current file'
                );
                return;
            }

            // Parse the graph structure
            const graphData = GraphParser.parseDocument(document);

            // Show the visualization
            WebviewProvider.show(context, graphData);
        }
    );
    context.subscriptions.push(showGraphCommand);

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

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

