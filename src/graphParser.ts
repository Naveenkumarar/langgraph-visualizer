import * as vscode from 'vscode';

export interface GraphNode {
    id: string;
    label: string;
    type: 'node' | 'start' | 'end';
    functionName?: string;
    lineNumber?: number;
    filePath?: string;           // NEW: Source file path
    subgraph?: GraphStructure;   // NEW: Nested subgraph if this node contains one
    imports?: string[];          // NEW: Files imported by this node's function
    hasSubgraph?: boolean;       // NEW: Whether this node contains a subgraph
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
    filePath?: string;           // NEW: Source file path
    imports?: string[];          // NEW: Files imported by this graph
    subgraphs?: GraphStructure[]; // NEW: Nested subgraphs
    parentGraph?: string;        // NEW: Parent graph ID if this is a subgraph
    level?: number;              // NEW: Nesting level (0 = root, 1 = first level subgraph, etc.)
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
        return this.parseText(text);
    }

    /**
     * Parse text directly and extract graph structure (without creating documents)
     */
    public static parseText(text: string): GraphStructure {
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

        // Pattern for .add_node("node_name", function) - enhanced to handle function calls
        const addNodePattern = /\.add_node\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/g;
        let match;

        while ((match = addNodePattern.exec(text)) !== null) {
            const nodeName = match[1];
            const functionExpression = match[2].trim();

            // Extract the actual function name from the expression
            let functionName = functionExpression;

            // Handle cases like: create_worker_a_graph().compile()
            const functionCallMatch = functionExpression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
            if (functionCallMatch) {
                functionName = functionCallMatch[1];
            }
            // Handle cases like: lambda x: {...}
            else if (functionExpression.startsWith('lambda')) {
                functionName = 'lambda';
            }

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

