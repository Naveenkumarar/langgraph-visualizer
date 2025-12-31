import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DebugServer, DebugMessage, getDebugServer, NodeExecutionData } from './debugServer';
import { getPythonRuntimeCode, generateDebugWrapperScript } from './pythonRuntime';

/**
 * Execution state for the debug session
 */
export type ExecutionState = 'stopped' | 'running' | 'paused' | 'stepping';

/**
 * Node execution info for display
 */
export interface NodeExecution {
    nodeId: string;
    nodeName: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: any;
    output?: any;
    stateBefore?: any;
    stateAfter?: any;
    startTime?: number;
    endTime?: number;
    duration?: number;
    error?: string;
}

/**
 * Execution log entry
 */
export interface ExecutionLogEntry {
    timestamp: number;
    type: 'node_start' | 'node_end' | 'state_update' | 'input' | 'output' | 'error' | 'info';
    nodeId?: string;
    message: string;
    data?: any;
}

/**
 * Time Capsule step - represents one step in execution history
 */
export interface TimeCapsuleStep {
    step: number;
    node: string;
    type: 'input' | 'node' | 'output';
    input: any;
    output: any;
    state_before: any;
    state_after: any;
    duration?: number;
    timestamp: string;
    error?: string;
}

/**
 * Debug session state
 */
export interface DebugSessionState {
    isActive: boolean;
    executionState: ExecutionState;
    currentNode: string | null;
    nodeExecutions: Map<string, NodeExecution>;
    executionLog: ExecutionLogEntry[];
    currentState: any;
    initialInput: any;
    finalOutput: any;
    breakpoints: Set<string>;
    startTime: number | null;
    port: number;
    pythonPath: string;
    timeCapsule: TimeCapsuleStep[];
    timeCapsuleIndex: number;
    timeCapsuleActive: boolean;
}

/**
 * Manages a debug session for LangGraph execution
 */
export class DebugSession {
    private server: DebugServer;
    private state: DebugSessionState;
    private terminal: vscode.Terminal | null = null;
    private runtimeFilePath: string | null = null;
    private wrapperFilePath: string | null = null;
    
    // Event emitter for state changes
    private _onStateChange = new vscode.EventEmitter<DebugSessionState>();
    public readonly onStateChange = this._onStateChange.event;
    
    private _onNodeUpdate = new vscode.EventEmitter<NodeExecution>();
    public readonly onNodeUpdate = this._onNodeUpdate.event;
    
    private _onLogEntry = new vscode.EventEmitter<ExecutionLogEntry>();
    public readonly onLogEntry = this._onLogEntry.event;
    
    constructor() {
        this.server = getDebugServer();
        this.state = this.createInitialState();
        
        // Set up server event handlers
        this.server.onMessage(this.handleMessage.bind(this));
        this.server.onConnected(this.handleConnected.bind(this));
        this.server.onDisconnected(this.handleDisconnected.bind(this));
    }
    
    private createInitialState(): DebugSessionState {
        // Get Python path from settings or use default
        const pythonConfig = vscode.workspace.getConfiguration('python');
        const defaultPythonPath = pythonConfig.get<string>('pythonPath') || 
                                   pythonConfig.get<string>('defaultInterpreterPath') || 
                                   'python';
        
        return {
            isActive: false,
            executionState: 'stopped',
            currentNode: null,
            nodeExecutions: new Map(),
            executionLog: [],
            currentState: null,
            initialInput: null,
            finalOutput: null,
            breakpoints: new Set(),
            startTime: null,
            port: 0,
            pythonPath: defaultPythonPath,
            timeCapsule: [],
            timeCapsuleIndex: 0,
            timeCapsuleActive: false
        };
    }
    
    /**
     * Set Python environment path
     */
    setPythonPath(pythonPath: string): void {
        this.state.pythonPath = pythonPath;
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Get Python environment path
     */
    getPythonPath(): string {
        return this.state.pythonPath;
    }
    
    /**
     * Get current debug state
     */
    getState(): DebugSessionState {
        return { ...this.state };
    }
    
    /**
     * Start a debug session
     */
    async start(document: vscode.TextDocument): Promise<boolean> {
        if (this.state.isActive) {
            vscode.window.showWarningMessage('Debug session already active. Stop it first.');
            return false;
        }
        
        try {
            // Start WebSocket server
            const port = await this.server.start();
            this.state.port = port;
            
            // Create runtime files
            await this.createRuntimeFiles(document, port);
            
            // Update state
            this.state.isActive = true;
            this.state.startTime = Date.now();
            this.state.executionState = 'stopped';
            this.state.nodeExecutions.clear();
            this.state.executionLog = [];
            
            this.addLogEntry('info', 'Debug session started');
            this.addLogEntry('info', `WebSocket server listening on port ${port}`);
            this.addLogEntry('info', `Python path: ${this.state.pythonPath}`);
            
            // Auto-open terminal
            this.openDebugTerminal(document);
            
            this._onStateChange.fire(this.state);
            return true;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start debug session: ${error}`);
            return false;
        }
    }
    
    /**
     * Stop the debug session
     */
    async stop(): Promise<void> {
        if (!this.state.isActive) {
            return;
        }
        
        // Send stop command if connected
        if (this.server.connected) {
            this.server.stopExecution();
        }
        
        // Stop server
        await this.server.stop();
        
        // Cleanup temp files
        this.cleanupRuntimeFiles();
        
        // Dispose terminal
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
        
        // Preserve time capsule data before resetting state
        const preservedCapsule = this.state.timeCapsule;
        const preservedCapsuleIndex = this.state.timeCapsuleIndex;
        const preservedCapsuleActive = this.state.timeCapsuleActive;
        
        // Reset state
        this.state = this.createInitialState();
        
        // Restore time capsule data
        this.state.timeCapsule = preservedCapsule;
        this.state.timeCapsuleIndex = preservedCapsuleIndex;
        this.state.timeCapsuleActive = preservedCapsuleActive;
        
        this.addLogEntry('info', 'Debug session stopped');
        
        this._onStateChange.fire(this.state);
        
        vscode.window.showInformationMessage('Debug session stopped');
    }
    
    /**
     * Pause execution
     */
    pause(): void {
        if (this.state.executionState === 'running') {
            this.server.pause();
            this.state.executionState = 'paused';
            this.addLogEntry('info', 'Execution paused');
            this._onStateChange.fire(this.state);
        }
    }
    
    /**
     * Resume execution
     */
    resume(): void {
        if (this.state.executionState === 'paused') {
            this.server.resume();
            this.state.executionState = 'running';
            this.addLogEntry('info', 'Execution resumed');
            this._onStateChange.fire(this.state);
        }
    }
    
    /**
     * Step one node
     */
    step(): void {
        if (this.state.executionState === 'paused') {
            this.server.step();
            this.state.executionState = 'stepping';
            this.addLogEntry('info', 'Stepping to next node');
            this._onStateChange.fire(this.state);
        }
    }
    
    /**
     * Toggle breakpoint on a node
     */
    toggleBreakpoint(nodeId: string): boolean {
        if (this.state.breakpoints.has(nodeId)) {
            this.state.breakpoints.delete(nodeId);
            this.server.removeBreakpoint(nodeId);
            this.addLogEntry('info', `Breakpoint removed from ${nodeId}`);
            return false;
        } else {
            this.state.breakpoints.add(nodeId);
            this.server.setBreakpoint(nodeId);
            this.addLogEntry('info', `Breakpoint set on ${nodeId}`);
            return true;
        }
    }
    
    // ============== Time Capsule Methods ==============
    
    /**
     * Activate the time capsule for navigation
     */
    activateTimeCapsule(): void {
        if (this.state.timeCapsule.length === 0) {
            vscode.window.showWarningMessage('No Time Capsule data available. Run the graph first.');
            return;
        }
        
        this.state.timeCapsuleActive = true;
        this.state.timeCapsuleIndex = 0;
        this.addLogEntry('info', 'Time Capsule activated');
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Deactivate the time capsule
     */
    deactivateTimeCapsule(): void {
        this.state.timeCapsuleActive = false;
        this.state.currentNode = null;
        this.addLogEntry('info', 'Time Capsule deactivated');
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Navigate to next step in time capsule
     */
    timeCapsuleNext(): void {
        if (!this.state.timeCapsuleActive || this.state.timeCapsule.length === 0) {
            return;
        }
        
        if (this.state.timeCapsuleIndex < this.state.timeCapsule.length - 1) {
            this.state.timeCapsuleIndex++;
            this.updateTimeCapsuleState();
        }
    }
    
    /**
     * Navigate to previous step in time capsule
     */
    timeCapsulePrevious(): void {
        if (!this.state.timeCapsuleActive || this.state.timeCapsule.length === 0) {
            return;
        }
        
        if (this.state.timeCapsuleIndex > 0) {
            this.state.timeCapsuleIndex--;
            this.updateTimeCapsuleState();
        }
    }
    
    /**
     * Update state based on current time capsule index
     */
    private updateTimeCapsuleState(): void {
        const step = this.state.timeCapsule[this.state.timeCapsuleIndex];
        if (step) {
            this.state.currentNode = step.node === '__start__' ? 'START' : 
                                     step.node === '__end__' ? 'END' : step.node;
            this.state.currentState = step.state_after;
            this.addLogEntry('info', `Time Capsule: Step ${step.step + 1}/${this.state.timeCapsule.length} - ${step.node}`);
            this._onStateChange.fire(this.state);
        }
    }
    
    /**
     * Get current time capsule step
     */
    getCurrentTimeCapsuleStep(): TimeCapsuleStep | null {
        if (this.state.timeCapsuleActive && this.state.timeCapsule.length > 0) {
            return this.state.timeCapsule[this.state.timeCapsuleIndex];
        }
        return null;
    }
    
    /**
     * Check if we're at the first step
     */
    isAtFirstStep(): boolean {
        return this.state.timeCapsuleIndex === 0;
    }
    
    /**
     * Check if we're at the last step
     */
    isAtLastStep(): boolean {
        return this.state.timeCapsuleIndex >= this.state.timeCapsule.length - 1;
    }
    
    /**
     * Create the runtime Python files
     */
    private async createRuntimeFiles(document: vscode.TextDocument, port: number): Promise<void> {
        const tempDir = os.tmpdir();
        const sessionId = Date.now().toString(36);
        
        // Create runtime module file
        this.runtimeFilePath = path.join(tempDir, `langgraph_visualizer_runtime_${sessionId}.py`);
        fs.writeFileSync(this.runtimeFilePath, getPythonRuntimeCode(port));
        
        // Create wrapper script
        const userScriptPath = document.uri.fsPath;
        this.wrapperFilePath = path.join(tempDir, `langgraph_debug_wrapper_${sessionId}.py`);
        fs.writeFileSync(this.wrapperFilePath, generateDebugWrapperScript(userScriptPath, port));
    }
    
    /**
     * Cleanup temporary runtime files
     */
    private cleanupRuntimeFiles(): void {
        try {
            if (this.runtimeFilePath && fs.existsSync(this.runtimeFilePath)) {
                fs.unlinkSync(this.runtimeFilePath);
            }
            if (this.wrapperFilePath && fs.existsSync(this.wrapperFilePath)) {
                fs.unlinkSync(this.wrapperFilePath);
            }
        } catch (error) {
            console.error('Failed to cleanup runtime files:', error);
        }
        this.runtimeFilePath = null;
        this.wrapperFilePath = null;
    }
    
    /**
     * Open a terminal with debug instructions
     */
    private openDebugTerminal(document: vscode.TextDocument): void {
        if (this.terminal) {
            this.terminal.dispose();
        }
        
        this.terminal = vscode.window.createTerminal({
            name: 'LangGraph Debug',
            cwd: path.dirname(document.uri.fsPath)
        });
        
        this.terminal.show();
        
        // Use stored python path
        const pythonPath = this.state.pythonPath;
        
        this.terminal.sendText('# LangGraph Visualizer Debug Session');
        this.terminal.sendText(`# Python: ${pythonPath}`);
        this.terminal.sendText(`# Port: ${this.state.port}`);
        this.terminal.sendText('');
        
        // Run the wrapper script interactively
        if (this.wrapperFilePath) {
            this.terminal.sendText(`${pythonPath} -i "${this.wrapperFilePath}"`);
        }
    }
    
    /**
     * Restart terminal with new python path
     */
    restartWithPythonPath(pythonPath: string, document: vscode.TextDocument): void {
        this.state.pythonPath = pythonPath;
        this.addLogEntry('info', `Python path changed to: ${pythonPath}`);
        this.openDebugTerminal(document);
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Handle message from Python runtime
     */
    private handleMessage(message: DebugMessage): void {
        const { type, data, timestamp } = message;
        
        switch (type) {
            case 'connected':
                this.addLogEntry('info', 'Python runtime connected');
                break;
                
            case 'graph_start':
                this.state.executionState = 'running';
                this.state.nodeExecutions.clear();
                this.addLogEntry('info', 'Graph execution started');
                this._onStateChange.fire(this.state);
                break;
                
            case 'graph_end':
                this.state.executionState = 'stopped';
                this.state.finalOutput = data?.output;
                
                // Store time capsule data
                if (data?.timeCapsule && Array.isArray(data.timeCapsule)) {
                    this.state.timeCapsule = data.timeCapsule;
                    this.state.timeCapsuleIndex = 0;
                    this.state.timeCapsuleActive = false;
                    this.addLogEntry('info', `Time Capsule recorded ${data.timeCapsule.length} steps`);
                }
                
                if (data?.error) {
                    this.addLogEntry('error', `Graph execution failed: ${data.error}`);
                } else {
                    this.addLogEntry('info', 'Graph execution completed');
                }
                this._onStateChange.fire(this.state);
                break;
                
            case 'node_start':
                this.handleNodeStart(data as NodeExecutionData);
                break;
                
            case 'node_end':
                this.handleNodeEnd(data as NodeExecutionData);
                break;
                
            case 'state_update':
                this.state.currentState = data?.state;
                this.addLogEntry('state_update', 'State updated', data);
                this._onStateChange.fire(this.state);
                break;
                
            case 'input':
                this.state.initialInput = data?.data;
                this.addLogEntry('input', 'Input received', data?.data);
                break;
                
            case 'output':
                this.state.finalOutput = data?.data;
                this.addLogEntry('output', 'Output produced', data?.data);
                break;
                
            case 'paused':
                this.state.executionState = 'paused';
                this.addLogEntry('info', `Execution paused at ${data?.node || 'unknown'}`);
                this._onStateChange.fire(this.state);
                break;
                
            case 'resumed':
                this.state.executionState = 'running';
                this.addLogEntry('info', 'Execution resumed');
                this._onStateChange.fire(this.state);
                break;
                
            case 'breakpoint_hit':
                this.state.executionState = 'paused';
                this.addLogEntry('info', `Breakpoint hit at ${data?.node}`);
                this._onStateChange.fire(this.state);
                break;
                
            case 'error':
                this.addLogEntry('error', data?.error || 'Unknown error', data);
                break;
                
            case 'stopped':
                this.state.executionState = 'stopped';
                this.addLogEntry('info', 'Execution stopped');
                this._onStateChange.fire(this.state);
                break;
        }
    }
    
    /**
     * Handle node start event
     */
    private handleNodeStart(data: NodeExecutionData): void {
        const nodeExec: NodeExecution = {
            nodeId: data.nodeId,
            nodeName: data.nodeName,
            status: 'running',
            input: data.input,
            stateBefore: data.stateBefore,
            startTime: Date.now()
        };
        
        this.state.nodeExecutions.set(data.nodeId, nodeExec);
        this.state.currentNode = data.nodeId;
        
        this.addLogEntry('node_start', `Node "${data.nodeName}" started`, data.input);
        
        this._onNodeUpdate.fire(nodeExec);
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Handle node end event
     */
    private handleNodeEnd(data: NodeExecutionData): void {
        const nodeExec = this.state.nodeExecutions.get(data.nodeId);
        
        if (nodeExec) {
            nodeExec.status = data.error ? 'error' : 'completed';
            nodeExec.output = data.output;
            nodeExec.stateAfter = data.stateAfter;
            nodeExec.endTime = Date.now();
            nodeExec.duration = data.duration || (nodeExec.endTime - (nodeExec.startTime || nodeExec.endTime));
            nodeExec.error = data.error;
            
            this.state.currentState = data.stateAfter;
            
            this.addLogEntry('node_end', `Node "${data.nodeName}" completed (${nodeExec.duration}ms)`, data.output);
            
            this._onNodeUpdate.fire(nodeExec);
        }
        
        if (this.state.currentNode === data.nodeId) {
            this.state.currentNode = null;
        }
        
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Handle Python runtime connected
     */
    private handleConnected(): void {
        this.addLogEntry('info', 'Python runtime connected');
        vscode.window.showInformationMessage('LangGraph debug session connected!');
        this._onStateChange.fire(this.state);
    }
    
    /**
     * Handle Python runtime disconnected
     */
    private handleDisconnected(): void {
        if (this.state.isActive) {
            this.addLogEntry('info', 'Python runtime disconnected');
            this.state.executionState = 'stopped';
            this._onStateChange.fire(this.state);
        }
    }
    
    /**
     * Add entry to execution log
     */
    private addLogEntry(type: ExecutionLogEntry['type'], message: string, data?: any): void {
        const entry: ExecutionLogEntry = {
            timestamp: Date.now(),
            type,
            message,
            data
        };
        
        this.state.executionLog.push(entry);
        this._onLogEntry.fire(entry);
    }
    
    /**
     * Get execution log
     */
    getExecutionLog(): ExecutionLogEntry[] {
        return [...this.state.executionLog];
    }
    
    /**
     * Get node executions
     */
    getNodeExecutions(): NodeExecution[] {
        return Array.from(this.state.nodeExecutions.values());
    }
    
    /**
     * Check if connected to Python runtime
     */
    isConnected(): boolean {
        return this.server.connected;
    }
    
    /**
     * Check if session is active
     */
    isActive(): boolean {
        return this.state.isActive;
    }
}

// Singleton instance
let debugSessionInstance: DebugSession | null = null;

export function getDebugSession(): DebugSession {
    if (!debugSessionInstance) {
        debugSessionInstance = new DebugSession();
    }
    return debugSessionInstance;
}

