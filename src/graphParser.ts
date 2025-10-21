import * as vscode from 'vscode';

export interface GraphNode {
    id: string;
    label: string;
    type: 'node' | 'start' | 'end' | 'tool' | 'agent';
    functionName?: string;
    lineNumber?: number;
    filePath?: string;           // NEW: Source file path
    subgraph?: GraphStructure;   // NEW: Nested subgraph if this node contains one
    imports?: string[];          // NEW: Files imported by this node's function
    hasSubgraph?: boolean;       // NEW: Whether this node contains a subgraph
    tools?: string[];            // NEW: List of tools used by this agent node
    toolType?: string;           // NEW: Type of tool (e.g., 'function', 'ToolNode', 'custom')
}

export interface GraphEdge {
    from: string;
    to: string;
    type: 'direct' | 'conditional' | 'bidirectional';
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
        const edges = this.extractEdges(text, nodes); // Pass nodes to create agent-tool edges
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

        // Extract tool definitions and agent definitions first
        const toolDefinitions = this.extractToolDefinitions(text);
        const agentDefinitions = this.extractAgentDefinitions(text);

        // Track which tools are actually used by agents in the graph
        const usedTools = new Set<string>();

        // Debug logging
        console.log('LangGraph Parser - Tool Definitions:', Array.from(toolDefinitions));
        console.log('LangGraph Parser - Agent Definitions:', Array.from(agentDefinitions.entries()));

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

                // Determine node type (tool, agent, or regular node)
                const nodeInfo = this.detectNodeType(nodeName, functionExpression, text, toolDefinitions, agentDefinitions);

                // Debug logging
                console.log(`LangGraph Parser - Node "${nodeName}": type=${nodeInfo.type}, tools=${nodeInfo.tools}, toolType=${nodeInfo.toolType}`);

                // Track tools used by this node
                if (nodeInfo.tools && nodeInfo.tools.length > 0) {
                    nodeInfo.tools.forEach(tool => usedTools.add(tool));
                }

                nodes.push({
                    id: nodeName,
                    label: nodeName,
                    type: nodeInfo.type,
                    functionName: functionName,
                    lineNumber: lineNumber,
                    tools: nodeInfo.tools,
                    toolType: nodeInfo.toolType
                });
            }
        }

        // Add tool nodes for tools that are used by agents in the graph
        usedTools.forEach(toolName => {
            if (!nodeSet.has(toolName)) {
                nodeSet.add(toolName);
                console.log(`LangGraph Parser - Adding tool node: ${toolName}`);
                nodes.push({
                    id: toolName,
                    label: toolName,
                    type: 'tool',
                    toolType: 'standalone'
                });
            }
        });

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
     * Extract tool definitions from the code
     */
    private static extractToolDefinitions(text: string): Set<string> {
        const tools = new Set<string>();

        // Pattern for @tool decorator
        const toolDecoratorPattern = /@tool\s*\n\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;

        while ((match = toolDecoratorPattern.exec(text)) !== null) {
            tools.add(match[1]);
        }

        // Pattern for ToolNode creation
        const toolNodePattern = /ToolNode\s*\(\s*\[([^\]]+)\]/g;
        while ((match = toolNodePattern.exec(text)) !== null) {
            const toolList = match[1];
            // Extract individual tool names
            const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (toolNames) {
                toolNames.forEach(name => tools.add(name));
            }
        }

        // Pattern for create_retriever_tool (RAG-specific)
        // e.g., retriever_tool = create_retriever_tool(retriever, "name", "description")
        const createRetrieverToolPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*create_retriever_tool\s*\(/g;
        while ((match = createRetrieverToolPattern.exec(text)) !== null) {
            tools.add(match[1]);
            console.log(`LangGraph Parser - Detected create_retriever_tool: ${match[1]}`);
        }

        // Pattern for other LangChain tool creation functions
        // e.g., tool = create_tool(...), tool = Tool.from_function(...)
        const createToolPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:create_tool|Tool\.from_function|StructuredTool\.from_function)\s*\(/g;
        while ((match = createToolPattern.exec(text)) !== null) {
            tools.add(match[1]);
            console.log(`LangGraph Parser - Detected tool creation: ${match[1]}`);
        }

        // Pattern for tool variable assignments (e.g., tavily_tool = TavilySearchResults(...))
        const toolVarPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:[A-Z][a-zA-Z0-9_]*\(|[a-zA-Z_][a-zA-Z0-9_]*\()/g;
        while ((match = toolVarPattern.exec(text)) !== null) {
            const varName = match[1];
            // Common tool variable naming patterns
            if (varName.toLowerCase().includes('tool') || varName.toLowerCase().includes('repl')) {
                tools.add(varName);
            }
        }

        return tools;
    }

    /**
     * Extract agent definitions and their associated tools from the code
     */
    private static extractAgentDefinitions(text: string): Map<string, { tools: string[], agentType: string }> {
        const agents = new Map<string, { tools: string[], agentType: string }>();

        // Pattern for create_react_agent with tools
        // e.g., research_agent = create_react_agent(llm, tools=[tavily_tool], ...)
        // Using [\s\S] to match across multiple lines, and non-greedy matching
        const reactAgentPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*create_react_agent\s*\([\s\S]*?tools\s*=\s*\[([^\]]+)\]/g;
        let match;

        while ((match = reactAgentPattern.exec(text)) !== null) {
            const agentName = match[1];
            const toolList = match[2];
            const tools: string[] = [];

            // Extract tool names from the list
            const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (toolNames) {
                tools.push(...toolNames);
            }

            console.log(`LangGraph Parser - Extracted agent "${agentName}" with tools: [${tools.join(', ')}]`);
            agents.set(agentName, { tools, agentType: 'create_react_agent' });
        }

        // Pattern for other agent types with tools parameter
        // e.g., agent = SomeAgent(tools=[...])
        const agentToolsPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[A-Z][a-zA-Z0-9_]*\([\s\S]*?tools\s*=\s*\[([^\]]+)\]/g;
        while ((match = agentToolsPattern.exec(text)) !== null) {
            const agentName = match[1];
            if (!agents.has(agentName)) {
                const toolList = match[2];
                const tools: string[] = [];

                const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
                if (toolNames) {
                    tools.push(...toolNames);
                }

                agents.set(agentName, { tools, agentType: 'agent_with_tools' });
            }
        }

        return agents;
    }

    /**
     * Detect if a node is a tool, agent, or regular node
     */
    private static detectNodeType(
        nodeName: string,
        functionExpression: string,
        fullText: string,
        toolDefinitions: Set<string>,
        agentDefinitions: Map<string, { tools: string[], agentType: string }>
    ): { type: 'node' | 'tool' | 'agent', tools?: string[], toolType?: string } {

        // Check if it's a ToolNode
        if (functionExpression.includes('ToolNode')) {
            // Extract tools used by this ToolNode
            const toolsMatch = functionExpression.match(/ToolNode\s*\(\s*\[([^\]]+)\]/);
            const tools: string[] = [];
            if (toolsMatch) {
                const toolList = toolsMatch[1];
                const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
                if (toolNames) {
                    tools.push(...toolNames);
                }
            }
            return { type: 'tool', tools, toolType: 'ToolNode' };
        }

        // Check if the function name is a known tool
        const functionNameMatch = functionExpression.match(/([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (functionNameMatch && toolDefinitions.has(functionNameMatch[1])) {
            return { type: 'tool', toolType: 'function' };
        }

        // Check if it's an agent (node that uses tools)
        // Look for the function definition and check if it uses bind_tools, tools=, or invokes tools
        const functionNameForAgent = functionExpression.match(/([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1];
        if (functionNameForAgent) {
            console.log(`LangGraph Parser - Looking for function: ${functionNameForAgent}`);

            // Find the function definition - improved pattern to handle type hints and multi-line signatures
            // Pattern explanation:
            // - def\s+functionName\s*\( - match function definition start
            // - [\s\S]*?\) - match parameters (lazy match to handle multi-line)
            // - (?:\s*->\s*[^:]+)? - optional return type annotation (match until colon)
            // - : - colon before function body
            // - [\s\S]*? - function body (lazy match)
            // - (?=\ndef\s|\nclass\s|$) - stop at next def/class or end of file
            const funcDefPattern = new RegExp(`def\\s+${functionNameForAgent}\\s*\\([\\s\\S]*?\\)(?:\\s*->\\s*[^:]+)?:[\\s\\S]*?(?=\\ndef\\s|\\nclass\\s|$)`);
            const funcDefMatch = fullText.match(funcDefPattern);

            if (funcDefMatch) {
                const funcBody = funcDefMatch[0];
                console.log(`LangGraph Parser - Found function body for ${functionNameForAgent}, length: ${funcBody.length}`);
                console.log(`LangGraph Parser - Checking against ${agentDefinitions.size} known agents`);

                // Check if function invokes any known agents
                for (const [agentName, agentInfo] of agentDefinitions.entries()) {
                    const agentInvokePattern = new RegExp(`\\b${agentName}\\.invoke\\s*\\(`);
                    console.log(`LangGraph Parser - Checking for ${agentName}.invoke in ${functionNameForAgent}`);

                    if (agentInvokePattern.test(funcBody)) {
                        console.log(`LangGraph Parser - ✓ Found ${agentName}.invoke in ${functionNameForAgent}!`);
                        // This function invokes an agent - treat it as an agent node
                        return { type: 'agent', tools: agentInfo.tools, toolType: agentInfo.agentType };
                    }
                }

                console.log(`LangGraph Parser - No agent invocations found in ${functionNameForAgent}`);

                // Check for create_react_agent pattern directly in function body
                if (/create_react_agent\s*\([^)]*tools\s*=\s*\[/.test(funcBody)) {
                    const tools = this.extractToolsFromParameter(funcBody);
                    return { type: 'agent', tools, toolType: 'create_react_agent' };
                }

                // Check for bind_tools pattern
                if (/\.bind_tools\s*\(/.test(funcBody)) {
                    const tools = this.extractToolsFromBindTools(funcBody);
                    return { type: 'agent', tools, toolType: 'bind_tools' };
                }

                // Check for with_structured_output (used in RAG grading, etc.)
                if (/\.with_structured_output\s*\(/.test(funcBody)) {
                    // Extract the schema/model name if available
                    const schemaMatch = funcBody.match(/\.with_structured_output\s*\(\s*([A-Z][a-zA-Z0-9_]*)/);
                    const schemaName = schemaMatch ? [schemaMatch[1]] : [];
                    return { type: 'agent', tools: schemaName, toolType: 'structured_output' };
                }

                // Check for tools= parameter
                if (/tools\s*=\s*\[/.test(funcBody)) {
                    const tools = this.extractToolsFromParameter(funcBody);
                    return { type: 'agent', tools, toolType: 'tools_param' };
                }

                // Check for ToolExecutor or AgentExecutor
                if (/ToolExecutor|AgentExecutor/.test(funcBody)) {
                    return { type: 'agent', toolType: 'executor' };
                }

                // Check if function invokes any known tools
                const usedTools: string[] = [];
                toolDefinitions.forEach(tool => {
                    if (new RegExp(`\\b${tool}\\s*\\(`).test(funcBody)) {
                        usedTools.push(tool);
                    }
                });

                if (usedTools.length > 0) {
                    return { type: 'agent', tools: usedTools, toolType: 'function_calls' };
                }
            }
        }

        // Default to regular node
        return { type: 'node' };
    }

    /**
     * Extract tool names from bind_tools() call
     */
    private static extractToolsFromBindTools(functionBody: string): string[] {
        const tools: string[] = [];

        // Pattern 1: .bind_tools([tool1, tool2])
        const bindToolsMatch = functionBody.match(/\.bind_tools\s*\(\s*\[([^\]]+)\]/);
        if (bindToolsMatch) {
            const toolList = bindToolsMatch[1];
            const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (toolNames) {
                tools.push(...toolNames);
            }
        }

        // Pattern 2: .bind_tools(tools=[tool1, tool2])
        const bindToolsKwargMatch = functionBody.match(/\.bind_tools\s*\(\s*tools\s*=\s*\[([^\]]+)\]/);
        if (bindToolsKwargMatch) {
            const toolList = bindToolsKwargMatch[1];
            const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (toolNames) {
                tools.push(...toolNames);
            }
        }

        return tools;
    }

    /**
     * Extract tool names from tools= parameter
     */
    private static extractToolsFromParameter(functionBody: string): string[] {
        const tools: string[] = [];
        const toolsMatch = functionBody.match(/tools\s*=\s*\[([^\]]+)\]/);

        if (toolsMatch) {
            const toolList = toolsMatch[1];
            const toolNames = toolList.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
            if (toolNames) {
                tools.push(...toolNames);
            }
        }

        return tools;
    }

    /**
     * Extract edges from the code
     */
    private static extractEdges(text: string, nodes: GraphNode[]): GraphEdge[] {
        const edges: GraphEdge[] = [];

        // Pattern for .add_edge(from, to) - handles both quoted strings and constants
        // Matches: .add_edge("from", "to"), .add_edge(START, "to"), .add_edge("from", END), etc.
        const addEdgePattern = /\.add_edge\s*\(\s*(?:["']([^"']+)["']|([A-Z_][A-Z0-9_]*))\s*,\s*(?:["']([^"']+)["']|([A-Z_][A-Z0-9_]*))/g;
        let match;

        while ((match = addEdgePattern.exec(text)) !== null) {
            // match[1] or match[2] is 'from' (quoted or constant)
            // match[3] or match[4] is 'to' (quoted or constant)
            const from = match[1] || match[2];
            const to = match[3] || match[4];

            edges.push({
                from: from,
                to: to,
                type: 'direct'
            });
        }

        // Pattern for .add_conditional_edges("from", function, {...}) or .add_conditional_edges(FROM_CONST, ...)
        // We need to carefully extract the function name, skipping comments
        const conditionalEdgePattern = /\.add_conditional_edges\s*\(\s*(?:["']([^"']+)["']|([A-Z_][A-Z0-9_]*))\s*,/g;

        while ((match = conditionalEdgePattern.exec(text)) !== null) {
            const fromNode = match[1] || match[2]; // Handle both quoted and constant

            // Now extract what comes after the first comma, skipping comments and whitespace
            const afterFirstComma = text.substring(match.index + match[0].length);

            // Match the function name, accounting for comments on separate lines
            // This will skip lines that start with # and capture the first identifier
            const functionNameMatch = afterFirstComma.match(/(?:[\s\n]*#[^\n]*\n)*\s*([a-zA-Z_][a-zA-Z0-9_]*)/);

            if (!functionNameMatch) {
                continue;
            }

            const functionName = functionNameMatch[1];
            console.log(`LangGraph Parser - Found conditional edge from "${fromNode}" with function "${functionName}"`);

            // Try to extract the mapping dictionary after the function name
            const afterFunction = afterFirstComma.substring(functionNameMatch[0].length);

            // First, find the closing parenthesis of this add_conditional_edges call
            // We need to properly count parentheses to find the matching close paren
            let parenCount = 1; // We already have the opening paren from add_conditional_edges(
            let closeParenIdx = -1;

            // Start from the position after the function name in the original text
            const searchStartIdx = match.index + match[0].length + functionNameMatch[0].length;

            for (let i = 0; i < text.length - searchStartIdx; i++) {
                const char = text[searchStartIdx + i];
                if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    parenCount--;
                    if (parenCount === 0) {
                        closeParenIdx = i;
                        break;
                    }
                }
            }

            if (closeParenIdx === -1) {
                console.log(`LangGraph Parser - Warning: Could not find closing parenthesis for add_conditional_edges from "${fromNode}"`);
                continue;
            }

            // Now only look for a dictionary within this function call
            const withinCall = text.substring(searchStartIdx, searchStartIdx + closeParenIdx);

            // Skip to the comma after the function name, then look for dictionary
            const afterFunctionComma = afterFunction.match(/\s*,\s*([\s\S]*)/);

            if (afterFunctionComma) {
                // Look for the dictionary/mapping - only within the function call bounds
                const dictMatch = withinCall.match(/,\s*\{[\s\S]*?\}/);

                if (dictMatch) {
                    const dictText = dictMatch[0].substring(dictMatch[0].indexOf('{'));
                    console.log(`LangGraph Parser - Found dictionary for conditional edge: ${dictText.substring(0, 100)}...`);

                    // Remove comments from dictionary text before parsing
                    const dictTextNoComments = dictText.replace(/#[^\n]*/g, '');

                    // Extract key-value pairs - handle both "key": "value" and CONST: CONST
                    // Pattern 1: "key": "value"
                    const quotedPairPattern = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
                    let pairMatch;

                    while ((pairMatch = quotedPairPattern.exec(dictTextNoComments)) !== null) {
                        console.log(`LangGraph Parser - Extracted edge: ${fromNode} -> ${pairMatch[2]} (label: ${pairMatch[1]})`);
                        edges.push({
                            from: fromNode,
                            to: pairMatch[2],
                            type: 'conditional',
                            label: pairMatch[1]
                        });
                    }

                    // Pattern 2: CONST: CONST (e.g., END: END)
                    const constPairPattern = /([A-Z_][A-Z0-9_]*)\s*:\s*([A-Z_][A-Z0-9_]*)/g;
                    while ((pairMatch = constPairPattern.exec(dictTextNoComments)) !== null) {
                        console.log(`LangGraph Parser - Extracted edge: ${fromNode} -> ${pairMatch[2]} (label: ${pairMatch[1]})`);
                        edges.push({
                            from: fromNode,
                            to: pairMatch[2],
                            type: 'conditional',
                            label: pairMatch[1]
                        });
                    }
                    continue; // Dictionary found, move to next conditional edge
                } else {
                    console.log(`LangGraph Parser - No dictionary found in add_conditional_edges call, will check function return type`);
                }
            }

            // No explicit mapping dictionary - try to extract from function's return type annotation
            // Look for: def function_name(...) -> Literal["node1", "node2"]:
            const funcDefPattern = new RegExp(`def\\s+${functionName}\\s*\\([\\s\\S]*?\\)\\s*->\\s*Literal\\[([^\\]]+)\\]`, 's');
            const funcDefMatch = text.match(funcDefPattern);

            if (funcDefMatch) {
                const literalContent = funcDefMatch[1];
                // Extract all quoted strings from the Literal
                const nodeNames = literalContent.match(/["']([^"']+)["']/g);

                if (nodeNames) {
                    console.log(`LangGraph Parser - Extracted conditional targets from Literal: ${nodeNames.join(', ')}`);
                    nodeNames.forEach(quotedName => {
                        const nodeName = quotedName.replace(/["']/g, '');
                        edges.push({
                            from: fromNode,
                            to: nodeName,
                            type: 'conditional'
                        });
                    });
                }
            } else {
                console.log(`LangGraph Parser - Warning: Could not find return type annotation for function "${functionName}"`);
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

        // Add bidirectional edges between agents and their tools
        console.log('LangGraph Parser - Creating agent-tool edges...');
        nodes.forEach(node => {
            if (node.type === 'agent' && node.tools && node.tools.length > 0) {
                node.tools.forEach(toolName => {
                    // Check if tool node exists
                    const toolNode = nodes.find(n => n.id === toolName && n.type === 'tool');
                    if (toolNode) {
                        console.log(`LangGraph Parser - Adding bidirectional edge: ${node.id} ↔ ${toolName}`);

                        // Single bidirectional edge (will be styled with arrows on both ends)
                        edges.push({
                            from: node.id,
                            to: toolName,
                            type: 'bidirectional',
                            label: 'uses'
                        });
                    }
                });
            }
        });

        return edges;
    }

    /**
     * Get line number for a character index in text
     */
    private static getLineNumber(text: string, index: number): number {
        return text.substring(0, index).split('\n').length;
    }
}

