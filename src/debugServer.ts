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
let WebSocket: any;
let WebSocketServer: any;

try {
    const ws = require('ws');
    WebSocket = ws;
    WebSocketServer = ws.Server;
} catch (e) {
    console.log('WebSocket module not available, debug features will be limited');
}

/**
 * Message types for communication between Python and VS Code
 */
export interface DebugMessage {
    type: 'node_start' | 'node_end' | 'state_update' | 'input' | 'output' | 
          'error' | 'graph_start' | 'graph_end' | 'paused' | 'resumed' | 
          'step' | 'stopped' | 'connected' | 'breakpoint_hit';
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
    
    constructor() {}
    
    /**
     * Start the WebSocket server
     */
    async start(preferredPort: number = 9876): Promise<number> {
        if (this.isRunning) {
            return this.port;
        }
        
        return new Promise((resolve, reject) => {
            if (!WebSocketServer) {
                reject(new Error('WebSocket module not available. Please install ws: npm install ws'));
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

