import * as vscode from 'vscode';

export interface GraphNode {
    id: string;
    label: string;
    type: 'node' | 'start' | 'end';
    functionName?: string;
    lineNumber?: number;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: 'direct' | 'conditional';
    label?: string;
}

export interface GraphStructure {
    nodes: GraphNode[];
    edges: GraphEdge[];
    graphType: string;
}

/**
 * Parses Python code to extract LangGraph structure
 */
export class GraphParser {
    /**
     * Parse a document and extract graph structure
     */
    public static parseDocument(document: vscode.TextDocument): GraphStructure {
        const text = document.getText();

        const nodes = this.extractNodes(text);
        const edges = this.extractEdges(text);
        const graphType = this.detectGraphType(text);

        return {
            nodes,
            edges,
            graphType
        };
    }

    /**
     * Detect the type of graph being used
     */
    private static detectGraphType(text: string): string {
        if (/StateGraph\s*\(/.test(text)) {
            return 'StateGraph';
        }
        if (/MessageGraph\s*\(/.test(text)) {
            return 'MessageGraph';
        }
        if (/Graph\s*\(/.test(text)) {
            return 'Graph';
        }
        return 'Unknown';
    }

    /**
     * Extract nodes from the code
     */
    private static extractNodes(text: string): GraphNode[] {
        const nodes: GraphNode[] = [];
        const nodeSet = new Set<string>();

        // Pattern for .add_node("node_name", function)
        const addNodePattern = /\.add_node\s*\(\s*["']([^"']+)["']\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;

        while ((match = addNodePattern.exec(text)) !== null) {
            const nodeName = match[1];
            const functionName = match[2];
            if (!nodeSet.has(nodeName)) {
                nodeSet.add(nodeName);

                // Find line number
                const lineNumber = this.getLineNumber(text, match.index);

                nodes.push({
                    id: nodeName,
                    label: nodeName,
                    type: 'node',
                    functionName: functionName,
                    lineNumber: lineNumber
                });
            }
        }

        // Check for START and END constants
        if (/START/.test(text) || /set_entry_point/.test(text)) {
            if (!nodeSet.has('START')) {
                nodes.unshift({
                    id: 'START',
                    label: 'START',
                    type: 'start'
                });
            }
        }

        if (/END/.test(text) || /set_finish_point/.test(text)) {
            if (!nodeSet.has('END')) {
                nodes.push({
                    id: 'END',
                    label: 'END',
                    type: 'end'
                });
            }
        }

        return nodes;
    }

    /**
     * Extract edges from the code
     */
    private static extractEdges(text: string): GraphEdge[] {
        const edges: GraphEdge[] = [];

        // Pattern for .add_edge("from", "to")
        const addEdgePattern = /\.add_edge\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g;
        let match;

        while ((match = addEdgePattern.exec(text)) !== null) {
            edges.push({
                from: match[1],
                to: match[2],
                type: 'direct'
            });
        }

        // Pattern for .add_conditional_edges("from", function, {...})
        const conditionalEdgePattern = /\.add_conditional_edges\s*\(\s*["']([^"']+)["']/g;

        while ((match = conditionalEdgePattern.exec(text)) !== null) {
            const fromNode = match[1];

            // Try to extract the mapping dictionary after this call
            const startIdx = match.index + match[0].length;
            const remainingText = text.substring(startIdx);

            // Look for the dictionary/mapping (simplified extraction)
            const dictMatch = remainingText.match(/\{[^}]*\}/);
            if (dictMatch) {
                const dictText = dictMatch[0];
                // Extract key-value pairs like "key": "value"
                const pairPattern = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
                let pairMatch;

                while ((pairMatch = pairPattern.exec(dictText)) !== null) {
                    edges.push({
                        from: fromNode,
                        to: pairMatch[2],
                        type: 'conditional',
                        label: pairMatch[1]
                    });
                }
            }
        }

        // Pattern for .set_entry_point("node")
        const entryPointPattern = /\.set_entry_point\s*\(\s*["']([^"']+)["']/g;
        while ((match = entryPointPattern.exec(text)) !== null) {
            edges.push({
                from: 'START',
                to: match[1],
                type: 'direct'
            });
        }

        // Pattern for .set_finish_point("node")
        const finishPointPattern = /\.set_finish_point\s*\(\s*["']([^"']+)["']/g;
        while ((match = finishPointPattern.exec(text)) !== null) {
            edges.push({
                from: match[1],
                to: 'END',
                type: 'direct'
            });
        }

        return edges;
    }

    /**
     * Get line number for a character index in text
     */
    private static getLineNumber(text: string, index: number): number {
        return text.substring(0, index).split('\n').length;
    }
}

