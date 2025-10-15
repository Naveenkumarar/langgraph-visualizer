# Contributing to LangGraph Visualizer

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/langgraph-visualizer.git
   cd langgraph-visualizer
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Start development**
   ```bash
   npm run watch
   ```

## Development Workflow

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Edit TypeScript files in `src/`
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   - Press F5 in VS Code to launch Extension Development Host
   - Test with files in `test_samples/`
   - Create new test cases if needed

4. **Check for linting errors**
   ```bash
   npm run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: description"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**

## Code Style

- Use TypeScript with strict mode enabled
- Follow existing code formatting
- Add JSDoc comments for public methods
- Use meaningful variable and function names

### Example

```typescript
/**
 * Extracts nodes from Python code
 * @param text The Python source code
 * @returns Array of graph nodes
 */
private static extractNodes(text: string): GraphNode[] {
    // Implementation
}
```

## Project Structure

```
langgraph-visualizer/
├── src/                    # TypeScript source files
│   ├── extension.ts       # Main extension logic
│   ├── graphDetector.ts   # Detection logic
│   ├── graphParser.ts     # Parsing logic
│   └── webviewProvider.ts # UI rendering
├── test_samples/          # Test Python files
├── media/                 # Icons and assets
├── out/                   # Compiled output (gitignored)
└── docs/                  # Documentation
```

## Areas to Contribute

### 1. Parser Improvements

**File**: `src/graphParser.ts`

Add support for:
- More LangGraph patterns
- Dynamic node names
- Variable tracking
- Complex conditional edges

### 2. Visualization Enhancements

**File**: `src/webviewProvider.ts`

Ideas:
- Interactive graph diagrams (D3.js, Cytoscape.js)
- Export as image
- Zoom and pan
- Node highlighting

### 3. Detection Logic

**File**: `src/graphDetector.ts`

Improvements:
- Better import detection
- Multi-graph support
- Performance optimizations

### 4. User Experience

**File**: `src/extension.ts`

Features:
- Click node to jump to code
- Quick actions menu
- Configuration options
- Keyboard shortcuts

### 5. Documentation

Always welcome:
- Tutorial improvements
- Example additions
- API documentation
- Video guides

### 6. Testing

Add test files to `test_samples/`:
- Edge cases
- Complex patterns
- Error scenarios

## Coding Guidelines

### TypeScript

- Use `const` for immutable values
- Use `let` only when reassignment is needed
- Avoid `any` types
- Prefer interfaces over type aliases for objects
- Use arrow functions for callbacks

### Naming Conventions

- Classes: `PascalCase`
- Functions/Methods: `camelCase`
- Constants: `UPPER_CASE`
- Private methods: `camelCase` (no underscore prefix)

### Error Handling

```typescript
try {
    // risky operation
} catch (error) {
    vscode.window.showErrorMessage(`Failed to parse: ${error}`);
    console.error('Parse error:', error);
}
```

## Adding New Features

### 1. Plan

- Open an issue describing the feature
- Discuss approach with maintainers
- Get feedback before coding

### 2. Implement

- Create a feature branch
- Write code following style guidelines
- Add comments and documentation

### 3. Test

- Test manually with various files
- Create test samples
- Ensure no regressions

### 4. Document

- Update README.md if needed
- Add to CHANGELOG.md
- Update USAGE.md for user features

### 5. Submit

- Create pull request
- Link related issues
- Describe changes clearly

## Pull Request Guidelines

### Title Format

```
[Type] Brief description

Types: Feature, Fix, Docs, Refactor, Test
```

### Description Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Changes Made
- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing
- Tested with sample files
- No regressions found

## Screenshots
(if applicable)
```

## Testing Your Changes

### Manual Testing

1. Launch Extension Development Host (F5)
2. Open test files from `test_samples/`
3. Verify status bar appears
4. Click icon and check visualization
5. Test edge cases

### Creating Test Samples

Add Python files to `test_samples/` covering:
- Your new feature
- Edge cases
- Potential failure scenarios

## Commit Message Format

Use clear, descriptive commit messages:

```
Add support for MessageGraph detection

- Updated graphDetector.ts to recognize MessageGraph
- Added test sample for MessageGraph
- Updated documentation
```

## Questions?

- Open an issue for questions
- Tag with "question" label
- Be specific and provide context

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn
- Focus on the code, not the person

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Credited in release notes
- Added to contributors list

Thank you for contributing to LangGraph Visualizer! 🎉

