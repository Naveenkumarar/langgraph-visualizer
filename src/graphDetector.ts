import * as vscode from 'vscode';

/**
 * Detects if a document contains LangGraph code
 */
export class GraphDetector {
    /**
     * Check if the document contains LangGraph imports and classes
     */
    public static hasLangGraph(document: vscode.TextDocument): boolean {
        if (document.languageId !== 'python') {
            return false;
        }

        const text = document.getText();

        // Check for LangGraph imports
        const hasImport = this.hasLangGraphImport(text);

        // Check for LangGraph classes
        const hasClasses = this.hasLangGraphClasses(text);

        return hasImport && hasClasses;
    }

    /**
     * Check for LangGraph imports
     */
    private static hasLangGraphImport(text: string): boolean {
        const importPatterns = [
            /from\s+langgraph/,
            /import\s+langgraph/,
            /from\s+langgraph\.\w+/,
        ];

        return importPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Check for LangGraph classes
     */
    private static hasLangGraphClasses(text: string): boolean {
        const classPatterns = [
            /StateGraph\s*\(/,
            /MessageGraph\s*\(/,
            /Graph\s*\(/,
            /CompiledGraph/,
        ];

        return classPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Get a list of detected graph types in the document
     */
    public static getDetectedGraphTypes(document: vscode.TextDocument): string[] {
        const text = document.getText();
        const types: string[] = [];

        if (/StateGraph\s*\(/.test(text)) {
            types.push('StateGraph');
        }
        if (/MessageGraph\s*\(/.test(text)) {
            types.push('MessageGraph');
        }
        if (/Graph\s*\(/.test(text)) {
            types.push('Graph');
        }

        return types;
    }
}

