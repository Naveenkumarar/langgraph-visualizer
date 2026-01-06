import * as vscode from 'vscode';
import * as http from 'http';

// WebSocket types for when the package is installed
interface WebSocketLike {
    send(data: string): void;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): void;
    readyState: number;
}

interface WebSocketServerLike {
    on(event: string, listener: (...args: any[]) => void): void;
    close(): void;
}

// Dynamic import for ws module
// eslint-disable-next-line @typescript-eslint/naming-convention
let WebSocket: any;
// eslint-disable-next-line @typescript-eslint/naming-convention
let WebSocketServer: any;
let wsLoadAttempted = false;

/**
 * Load the ws module with Windows-specific path handling
 * This function tries multiple strategies to find and load the ws module
 */
function loadWebSocketModule(): boolean {
    if (WebSocketServer) {
        return true; // Already loaded
    }

    if (wsLoadAttempted) {
        return false; // Already tried and failed
    }

    wsLoadAttempted = true;
    const fs = require('fs');
    const pathModule = require('path');

    // Strategy 1: Try standard require (works in most cases)
    try {
        // Diagnostic: Log where require.resolve finds ws
        try {
            const resolvedPath = require.resolve('ws');
            console.log(`[DIAGNOSTIC] require.resolve('ws') found at: ${resolvedPath}`);
        } catch (resolveError) {
            console.log(`[DIAGNOSTIC] require.resolve('ws') failed: ${resolveError}`);
        }
        
        // Diagnostic: Log module paths
        const Module = require('module');
        console.log(`[DIAGNOSTIC] Module search paths:`, Module._nodeModulePaths(__dirname));
        
        const ws = require('ws');
        if (ws && ws.Server) {
            WebSocket = ws;
            WebSocketServer = ws.Server;
            console.log('[DIAGNOSTIC] WebSocket module loaded successfully via standard require');
            return true;
        }
    } catch (e: any) {
        // Continue to next strategy
        console.log(`[DIAGNOSTIC] Standard require failed: ${e.message}, trying extension path...`);
    }

    // Strategy 2: Load from extension's node_modules (Windows-specific fix)
    try {
        const extension = vscode.extensions.getExtension('smazee.langgraph-visualizer');
        if (extension) {
            const extensionPath = extension.extensionPath;
            console.log(`[DIAGNOSTIC] Extension path: ${extensionPath}`);
            
            const wsPath = pathModule.join(extensionPath, 'node_modules', 'ws');
            console.log(`[DIAGNOSTIC] Checking for ws at: ${wsPath}`);
            
            // Check if ws exists in extension's node_modules
            if (fs.existsSync(wsPath)) {
                console.log(`[DIAGNOSTIC] ws directory exists at extension path`);
                // Try to load the package.json to find the main entry point
                const packageJsonPath = pathModule.join(wsPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    try {
                        // Try direct require with the path
                        const ws = require(wsPath);
                        if (ws && ws.Server) {
                            WebSocket = ws;
                            WebSocketServer = ws.Server;
                            console.log(`WebSocket module loaded from extension path: ${wsPath}`);
                            return true;
                        }
                    } catch (e) {
                        // Try loading the main file directly
                        try {
                            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                            const mainFile = packageJson.main || 'index.js';
                            const mainPath = pathModule.join(wsPath, mainFile);
                            
                            if (fs.existsSync(mainPath)) {
                                // Use absolute path for require on Windows
                                const absoluteMainPath = pathModule.resolve(mainPath);
                                const wsModule = require(absoluteMainPath);
                                
                                if (wsModule && wsModule.Server) {
                                    WebSocket = wsModule;
                                    WebSocketServer = wsModule.Server;
                                    console.log(`WebSocket module loaded from: ${absoluteMainPath}`);
                                    return true;
                                }
                            }
                        } catch (innerError) {
                            console.error('Failed to load ws from package.json main:', innerError);
                        }
                    }
                }
            } else {
                console.warn(`[DIAGNOSTIC] ws module not found at expected path: ${wsPath}`);
                // Check parent directories
                const parentNodeModules = pathModule.join(extensionPath, '..', 'node_modules', 'ws');
                console.log(`[DIAGNOSTIC] Checking parent node_modules: ${parentNodeModules}, exists: ${fs.existsSync(parentNodeModules)}`);
            }
        } else {
            console.warn('[DIAGNOSTIC] Extension not found via getExtension');
        }
    } catch (e) {
        console.error('[DIAGNOSTIC] Failed to load ws from extension path:', e);
    }

    // Strategy 3: Try from __dirname (for development)
    try {
        const currentDir = __dirname;
        const wsPath = pathModule.join(currentDir, '..', 'node_modules', 'ws');
        if (fs.existsSync(wsPath)) {
            const ws = require(wsPath);
            if (ws && ws.Server) {
                WebSocket = ws;
                WebSocketServer = ws.Server;
                console.log(`WebSocket module loaded from development path: ${wsPath}`);
                return true;
            }
        }
    } catch (e) {
        // Ignore
    }

    console.error('WebSocket module not available. All loading strategies failed.');
    return false;
}

/**
 * Message types for communication between Python and VS Code
 */
export interface DebugMessage {
    type: 'node_start' | 'node_end' | 'state_update' | 'input' | 'output' |
    'error' | 'graph_start' | 'graph_end' | 'paused' | 'resumed' |
    'step' | 'stopped' | 'connected' | 'breakpoint_hit' | 'request_input';
    timestamp: number;
    data: any;
}

export interface NodeExecutionData {
    nodeId: string;
    nodeName: string;
    input?: any;
    output?: any;
    state?: any;
    stateBefore?: any;
    stateAfter?: any;
    duration?: number;
    error?: string;
}

export interface GraphExecutionData {
    graphName?: string;
    initialInput?: any;
    finalOutput?: any;
    totalDuration?: number;
}

/**
 * WebSocket server for debug communication with Python runtime
 */
export class DebugServer {
    private server: http.Server | null = null;
    private wss: any = null;
    private client: any = null;
    private port: number = 0;
    private isRunning: boolean = false;

    // Event callbacks
    private onMessageCallback?: (message: DebugMessage) => void;
    private onConnectedCallback?: () => void;
    private onDisconnectedCallback?: () => void;

    constructor() { }

    /**
     * Start the WebSocket server
     */
    async start(preferredPort: number = 9876): Promise<number> {
        if (this.isRunning) {
            return this.port;
        }

        return new Promise((resolve, reject) => {
            // Try to load the module if not already loaded (lazy loading)
            if (!loadWebSocketModule()) {
                const extension = vscode.extensions.getExtension('smazee.langgraph-visualizer');
                let errorMessage = 'WebSocket module not available. Please install ws: npm install ws';
                
                if (extension) {
                    const extensionPath = extension.extensionPath;
                    const fs = require('fs');
                    const pathModule = require('path');
                    const wsPath = pathModule.join(extensionPath, 'node_modules', 'ws');
                    const exists = fs.existsSync(wsPath);
                    
                    errorMessage += `\n\nExtension path: ${extensionPath}`;
                    errorMessage += `\nExpected ws location: ${wsPath}`;
                    errorMessage += `\nws exists: ${exists}`;
                    
                    if (!exists) {
                        errorMessage += '\n\nTroubleshooting steps:';
                        errorMessage += '\n1. Navigate to the extension directory';
                        errorMessage += '\n2. Run: npm install';
                        errorMessage += '\n3. Verify node_modules/ws exists';
                        errorMessage += '\n4. Restart VS Code';
                    }
                }
                
                reject(new Error(errorMessage));
                return;
            }

            this.server = http.createServer();
            this.wss = new WebSocketServer({ server: this.server });

            this.wss.on('connection', (ws: any) => {
                console.log('LangGraph Debug: Python runtime connected');
                this.client = ws;

                ws.on('message', (data: any) => {
                    try {
                        const message: DebugMessage = JSON.parse(data.toString());
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('LangGraph Debug: Failed to parse message:', error);
                    }
                });

                ws.on('close', () => {
                    console.log('LangGraph Debug: Python runtime disconnected');
                    this.client = null;
                    if (this.onDisconnectedCallback) {
                        this.onDisconnectedCallback();
                    }
                });

                ws.on('error', (error: Error) => {
                    console.error('LangGraph Debug: WebSocket error:', error);
                });

                if (this.onConnectedCallback) {
                    this.onConnectedCallback();
                }
            });

            // Try to find an available port
            const tryPort = (port: number) => {
                this.server!.listen(port, '127.0.0.1', () => {
                    this.port = port;
                    this.isRunning = true;
                    console.log(`LangGraph Debug: Server started on port ${port}`);
                    resolve(port);
                });

                this.server!.on('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE') {
                        // Port in use, try next
                        tryPort(port + 1);
                    } else {
                        reject(err);
                    }
                });
            };

            tryPort(preferredPort);
        });
    }

    /**
     * Stop the WebSocket server
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.close();
                this.client = null;
            }

            if (this.wss) {
                this.wss.close();
                this.wss = null;
            }

            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    this.isRunning = false;
                    console.log('LangGraph Debug: Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Check if server is running
     */
    get running(): boolean {
        return this.isRunning;
    }

    /**
     * Check if a client is connected
     */
    get connected(): boolean {
        return this.client !== null && this.client.readyState === 1; // WebSocket.OPEN = 1
    }

    /**
     * Get the server port
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Send a command to the Python runtime
     */
    send(command: string, data?: any): boolean {
        if (!this.connected) {
            console.warn('LangGraph Debug: No client connected');
            return false;
        }

        const message = JSON.stringify({
            command,
            data,
            timestamp: Date.now()
        });

        this.client!.send(message);
        return true;
    }

    /**
     * Send pause command
     */
    pause(): boolean {
        return this.send('pause');
    }

    /**
     * Send resume command
     */
    resume(): boolean {
        return this.send('resume');
    }

    /**
     * Send step command
     */
    step(): boolean {
        return this.send('step');
    }

    /**
     * Send stop command
     */
    stopExecution(): boolean {
        return this.send('stop');
    }

    /**
     * Set breakpoint
     */
    setBreakpoint(nodeId: string): boolean {
        return this.send('set_breakpoint', { nodeId });
    }

    /**
     * Remove breakpoint
     */
    removeBreakpoint(nodeId: string): boolean {
        return this.send('remove_breakpoint', { nodeId });
    }

    /**
     * Handle incoming message from Python
     */
    private handleMessage(message: DebugMessage): void {
        console.log('LangGraph Debug: Received message:', message.type);

        if (this.onMessageCallback) {
            this.onMessageCallback(message);
        }
    }

    /**
     * Set message handler
     */
    onMessage(callback: (message: DebugMessage) => void): void {
        this.onMessageCallback = callback;
    }

    /**
     * Set connected handler
     */
    onConnected(callback: () => void): void {
        this.onConnectedCallback = callback;
    }

    /**
     * Set disconnected handler
     */
    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback;
    }
}

// Singleton instance
let debugServerInstance: DebugServer | null = null;

export function getDebugServer(): DebugServer {
    if (!debugServerInstance) {
        debugServerInstance = new DebugServer();
    }
    return debugServerInstance;
}

