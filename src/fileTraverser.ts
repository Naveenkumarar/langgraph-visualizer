import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GraphStructure } from './graphParser';
import { GraphParser } from './graphParser';

export class FileTraverser {
    private visitedFiles = new Set<string>();
    private workspaceRoot: string;
    private debugCallback?: (message: string) => void;

    constructor(workspaceRoot: string, debugCallback?: (message: string) => void) {
        this.workspaceRoot = workspaceRoot;
        this.debugCallback = debugCallback;
    }

    private debugLog(message: string): void {
        if (this.debugCallback) {
            this.debugCallback(message);
        }
    }

    /**
     * Traverse graph structure across multiple files
     */
    async traverseGraph(rootFile: string): Promise<GraphStructure> {
        this.visitedFiles.clear();
        const result = await this.traverseFile(rootFile, 0);
        return result;
    }

    /**
     * Traverse a single file and extract graph structure
     */
    private async traverseFile(filePath: string, level: number): Promise<GraphStructure> {
        if (this.visitedFiles.has(filePath)) {
            return this.createEmptyGraph(filePath, level);
        }

        this.visitedFiles.add(filePath);

        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();

            const graphStructure = GraphParser.parseDocument(document);
            graphStructure.filePath = filePath;
            graphStructure.level = level;

            const imports = this.extractImports(text);
            graphStructure.imports = imports;

            this.debugLog(`Found imports in ${filePath}: ${imports.join(', ')}`);
            this.debugLog(`Processing ${graphStructure.nodes.length} nodes in ${filePath}`);

            for (const node of graphStructure.nodes) {
                node.filePath = filePath;
                this.debugLog(`Processing node: ${node.id}, functionName: ${node.functionName}`);

                const subgraph = await this.findSubgraphInFunction(filePath, node.functionName || node.id);
                if (subgraph) {
                    node.subgraph = subgraph;
                    node.hasSubgraph = true;
                    continue;
                }

                const calledGraphFunction = await this.findCalledGraphFunction(filePath, node.functionName || node.id);
                if (calledGraphFunction) {
                    const importedGraph = await this.findGraphFromImportedFunction(calledGraphFunction, graphStructure.imports || []);
                    if (importedGraph) {
                        node.subgraph = importedGraph;
                        node.hasSubgraph = true;
                        continue;
                    }
                }

                const functionName = node.functionName;
                if (functionName && functionName !== 'lambda' && functionName !== 'main_process' && functionName !== 'finalize_process') {
                    const importedGraph = await this.findGraphFromImportedFunction(functionName, graphStructure.imports || []);
                    if (importedGraph) {
                        node.subgraph = importedGraph;
                        node.hasSubgraph = true;
                        node.subgraph.parentGraph = node.id;
                    }
                }
            }

            return graphStructure;
        } catch (error) {
            this.debugLog(`Error traversing file ${filePath}: ${error}`);
            return this.createEmptyGraph(filePath, level);
        }
    }

    /**
     * Extract Python imports from file text
     */
    private extractImports(text: string): string[] {
        const imports: string[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('from ') && trimmedLine.includes(' import ')) {
                const match = trimmedLine.match(/from\s+([^\s]+)\s+import/);
                if (match) {
                    imports.push(match[1]);
                }
            } else if (trimmedLine.startsWith('import ')) {
                const match = trimmedLine.match(/import\s+([^\s,]+)/);
                if (match) {
                    imports.push(match[1]);
                }
            }
        }

        return imports;
    }

    /**
     * Check if function contains graph creation
     */
    private containsGraphCreation(functionBody: string): boolean {
        return /StateGraph|MessageGraph|Graph\s*\(/.test(functionBody) &&
            /add_node|add_edge|add_conditional_edges/.test(functionBody);
    }

    /**
     * Extract function body from file text
     */
    private extractFunctionBody(text: string, functionName: string): string {
        const lines = text.split('\n');
        let inFunction = false;
        let functionBody = '';
        let indentLevel = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith(`def ${functionName}(`) || trimmedLine.startsWith(`async def ${functionName}(`)) {
                inFunction = true;
                indentLevel = line.length - line.trimStart().length;
                continue;
            }

            if (inFunction) {
                if (trimmedLine && line.length - line.trimStart().length <= indentLevel && !trimmedLine.startsWith('#')) {
                    break;
                }
                functionBody += line + '\n';
            }
        }

        return functionBody;
    }

    /**
     * Find the starting line number of a function in the file
     */
    private findFunctionStartLine(text: string, functionName: string): number {
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (trimmedLine.startsWith(`def ${functionName}(`) || trimmedLine.startsWith(`async def ${functionName}(`)) {
                return i + 1; // VS Code uses 1-based line numbers
            }
        }

        return 0; // Function not found
    }

    /**
     * Find subgraph in function body
     */
    private async findSubgraphInFunction(filePath: string, functionName: string): Promise<GraphStructure | null> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();

            const functionBody = this.extractFunctionBody(text, functionName);
            if (!functionBody) {
                return null;
            }

            if (this.containsGraphCreation(functionBody)) {
                const graph = GraphParser.parseText(functionBody);
                graph.filePath = filePath;

                // Find the function's starting line number in the file
                const functionStartLine = this.findFunctionStartLine(text, functionName);
                if (functionStartLine > 0) {
                    // Adjust line numbers to be relative to the file
                    graph.nodes.forEach(node => {
                        if (node.lineNumber) {
                            node.lineNumber = node.lineNumber + functionStartLine - 1;
                        }
                    });
                }

                return graph;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Find called graph function in function body
     */
    private async findCalledGraphFunction(filePath: string, functionName: string): Promise<string | null> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();

            const functionBody = this.extractFunctionBody(text, functionName);
            if (!functionBody) {
                return null;
            }

            const match = functionBody.match(/(\w+)\(\)\.compile\(\)/);
            if (match) {
                return match[1];
            }

            const directMatch = functionBody.match(/(\w+)\(\)/);
            if (directMatch) {
                return directMatch[1];
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Find graph from imported function
     */
    private async findGraphFromImportedFunction(functionName: string, imports: string[]): Promise<GraphStructure | null> {
        for (const importPath of imports) {
            try {
                const resolvedPath = await this.resolveImport(importPath);
                if (resolvedPath && !this.visitedFiles.has(resolvedPath)) {
                    const graph = await this.findGraphInImportedFunction(resolvedPath, functionName);
                    if (graph) {
                        return graph;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    /**
     * Find graph in imported function
     */
    private async findGraphInImportedFunction(filePath: string, functionName: string): Promise<GraphStructure | null> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();

            const functionBody = this.extractFunctionBody(text, functionName);
            if (!functionBody) {
                return null;
            }

            if (this.containsGraphCreation(functionBody)) {
                const graph = GraphParser.parseText(functionBody);
                graph.filePath = filePath;

                // Find the function's starting line number in the file
                const functionStartLine = this.findFunctionStartLine(text, functionName);
                if (functionStartLine > 0) {
                    // Adjust line numbers to be relative to the file
                    graph.nodes.forEach(node => {
                        if (node.lineNumber) {
                            node.lineNumber = node.lineNumber + functionStartLine - 1;
                        }
                    });
                }

                return graph;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Resolve import path to file path
     */
    private async resolveImport(importPath: string): Promise<string | null> {
        if (fs.existsSync(importPath)) {
            return importPath;
        }

        const directPath = path.join(this.workspaceRoot, importPath + '.py');
        if (fs.existsSync(directPath)) {
            return directPath;
        }

        const modulePath = path.join(this.workspaceRoot, importPath.replace(/\./g, '/') + '.py');
        if (fs.existsSync(modulePath)) {
            return modulePath;
        }

        try {
            const files = await vscode.workspace.findFiles(
                `**/${importPath.replace(/\./g, '/')}.py`,
                `**/${importPath.split('.').pop()}.py`
            );
            return files.length > 0 ? files[0].fsPath : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Build complete graph hierarchy
     */
    async buildGraphHierarchy(rootFile: string): Promise<GraphStructure> {
        const rootGraph = await this.traverseGraph(rootFile);
        await this.processSubgraphs(rootGraph);
        return rootGraph;
    }

    /**
     * Process subgraphs recursively
     */
    private async processSubgraphs(graph: GraphStructure): Promise<void> {
        for (const node of graph.nodes) {
            if (node.subgraph) {
                await this.processSubgraphs(node.subgraph);
            }
        }
    }

    /**
     * Create empty graph structure
     */
    private createEmptyGraph(filePath: string, level: number): GraphStructure {
        return {
            nodes: [],
            edges: [],
            graphType: 'Unknown',
            filePath,
            level
        };
    }
}