# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Guidelines

- **TDD**: Follow Test-Driven Development (TDD) principles. Write tests before implementing features to ensure functionality and reliability. ALWAYS write tests for new features and bug fixes.
- **Code Quality**: Ensure that the code is well-structured, modular, and follows best practices for readability and maintainability.  
  - ALWAYS make sure each file has a limit of 400 lines of code to ensure readability and maintainability.
  - ALWAYS use typing and eliminate the typing errors and ensure that the code is free of linting issues.
- **Documentation**: Provide clear and concise documentation for the code, including comments and README files. ALWAYS update the documentation when making changes to the codebase.
- **Testing**: Implement unit tests to ensure the functionality of the agent and its components.
- **Version Control**: Use Git for version control and maintain a clean commit history. 
- **Error Handling**: Implement robust error handling to ensure the agent can gracefully handle unexpected situations.
- Use context7 for library documents

## Common Commands

### Development
```bash
npm run build        # Compile TypeScript to JavaScript in dist/
npm run test         # Run Jest tests with coverage
npm run dev          # Run scanner directly with ts-node
npm run scan         # Run compiled scanner from dist/
```

### Testing
```bash
npm test             # Run all tests with coverage
npm test -- --watch # Run tests in watch mode
npm test -- --verbose # Run tests with verbose output
```

### Publishing
```bash
npm run publish:release    # Interactive publish script with version bumping
npm run prepublishOnly     # Build before publishing (runs automatically)
```

The `publish.sh` script handles the complete release workflow:
- Validates git status and branch
- Interactive version selection (patch/minor/major)
- Builds the project
- Commits changes with git tags
- Publishes to npm

## Project Architecture

This is an i18n (internationalization) automation tool that scans code for text and converts it to I18n function calls with Google Sheets integration.

### Core Components

**Main Entry Point:** `src/scan.ts` - CLI entry point that loads config and starts scanning

**Core Services:**
- `src/core/I18nScanner.ts` - Main orchestrator that coordinates the entire scan process
- `src/core/FileScanner.ts` - Scans filesystem for files to process
- `src/core/FileTransformer.ts` - Transforms code using jscodeshift to replace text with I18n.t() calls
- `src/core/AstTransformer.ts` - AST manipulation for code transformations
- `src/core/TranslationManager.ts` - Manages translation files and records
- `src/core/GoogleSheetsSync.ts` - Synchronizes translations with Google Sheets
- `src/core/UnusedKeyAnalyzer.ts` - Analyzes code to detect unused translation keys
- `src/core/DeleteService.ts` - Handles deletion of unused keys with backup functionality

**User Interface:**
- `src/ui/ProgressIndicator.ts` - Shows scan progress
- `src/ui/UserInteraction.ts` - Handles user prompts and confirmations

**Utilities:**
- `src/utils/StringUtils.ts` - String manipulation and logging utilities
- `src/utils/AstUtils.ts` - AST helper functions
- `src/utils/PathUtils.ts` - File path utilities

### Configuration

The tool requires an `i18n.config.js` file in the project root. Key configuration options:

**Core Settings:**
- `rootDir`: Directory to scan for translatable text
- `languages`: Array of language codes (e.g., `["en", "ko", "zh-CN"]`)
- `outputDir`: Where translation files are generated
- `include`: File extensions to scan (e.g., `["js", "jsx", "ts", "tsx"]`)
- `ignore`: Directories/files to exclude from scanning

**Text Processing:**
- `startMarker`/`endMarker`: Text markers for manual text wrapping (e.g., `"~"`)

**Google Sheets Integration:**
- `spreadsheetId`: Google Sheets ID for remote translation sync
- `sheetName`: Sheet name within the spreadsheet (default: "i18n")
- `keyFile`: Path to Google service account key file
- `sheetsReadRange`: Data range to read (default: "A1:Z10000")
- `sheetsMaxRows`: Maximum rows to process (default: 10000)

**Advanced Options:**
- `forceKeepKeys`: Keys to preserve even if detected as unused
- `logLevel`: Logging verbosity (`"silent"` | `"normal"` | `"verbose"`)
- `apiKey`: API key for LLM-powered automatic translation

**Example configuration from demo/vite/i18n.config.js:**
```javascript
module.exports = {
  rootDir: "./",
  languages: ["de", "en", "es", "ko", "tr", "vi", "zh-CN", "zh-TC"],
  ignore: ["**/test/**", "**/node_modules/**"],
  include: ["js", "jsx", "ts", "tsx"],
  outputDir: "./src/translate",
  startMarker: "~",
  endMarker: "~",
  spreadsheetId: "1UbZdMrqQ38XnbYBrxxdkmk9uS5sVxz1APtRELPYMQOM",
  sheetName: "i18n",
  keyFile: "./serviceAccountKeyFile.json",
  logLevel: "verbose"
};
```

### Text Processing Modes

1. **Marker Mode**: Text wrapped in configurable markers (e.g., `~Hello World~`)
2. **JSX Text Mode**: Pure text nodes in JSX elements (automatically detected)

### Translation Key Generation

- Uses MD5 hash based on file path and text content
- Ensures unique keys across the entire project
- Supports template strings with variable interpolation

### Data Flow

The complete scanning and translation workflow:

1. **Remote Sync (Pull)**: Fetch existing translations from Google Sheets and merge with local complete record
2. **File Discovery**: Scan project files based on `include`/`ignore` patterns
3. **Text Extraction**: Find marked text (`~text~`) and JSX text nodes, collect existing I18n.t() references
4. **Code Transformation**: Replace found text with I18n.t() calls using jscodeshift AST manipulation
5. **Translation Generation**: Build complete translation record with automatic LLM translation for new keys
6. **Unused Key Detection**: Analyze code to find orphaned translation keys, with interactive user confirmation
7. **File Generation**: Create modular translation files mirroring source structure  
8. **Remote Sync (Push)**: Upload updated translations back to Google Sheets

### Translation File Structure

The tool generates a **modular translation system**:

**Complete Record** (`i18n-complete-record.json`):
- Central repository containing all translations organized by module path
- Format: `{ "ModulePath.ts": { "Key": { "en": "text", "ko": "텍스트", "mark": 0 } } }`

**Modular Files** (`.ts` files):
- Mirror source code directory structure in `outputDir`
- Each source file gets corresponding translation file
- TypeScript modules with default export of translation object

**Path Mapping Examples**:
```
src/components/Header.tsx → outputDir/components/Header.ts
pages/home.jsx → outputDir/pages/home.ts  
TestModular.tsx → outputDir/TestModular.ts
```

**Generated File Content**:
```typescript
const translations = {
  "en": { "Welcome": "Welcome", "Login": "Login" },
  "ko": { "Welcome": "환영합니다", "Login": "로그인" }
};
export default translations;
```

### Demo Projects

- `demo/nextjs/` - Next.js integration example
- `demo/vite/` - Vite integration example

Both demos show real usage patterns and configuration setups.

## Testing

**Test Framework**: Jest with ts-jest preset
**Test Pattern**: `**/__tests__/**/*.test.ts`
**Coverage**: Enabled by default, reports in `coverage/` directory

**Key Test Configuration** (jest.config.js):
- TypeScript support via ts-jest
- Node environment for CLI tool testing
- Coverage collection excludes node_modules and test files
- Verbose output enabled

**Running Tests**:
```bash
npm test                # Run all tests with coverage
npm test -- --watch    # Watch mode for development
npm test -- --verbose  # Detailed test output
```

## Build System

**TypeScript Configuration**:
- Target: ES2018 with CommonJS modules
- Strict mode enabled
- Output: `dist/` directory (mirrors `src/` structure)
- Excludes: `node_modules`, `dist`, test directories

**Build Process**:
```bash
npm run build    # Clean dist/ and compile TypeScript
npm run dev      # Run directly with ts-node (development)
npm run scan     # Run compiled version from dist/
```

**Binary Distribution**:
- Main entry: `dist/scan.js` 
- CLI command: `i18n-google` (via bin field in package.json)
- Published files: `dist/`, `README.md`, `LICENSE`

## Important Implementation Details

**Code Transformation**:
- Uses jscodeshift for AST-based code modifications
- Directly modifies source files (ensure version control/backups)
- Automatically imports I18n utility when needed
- Supports variable interpolation in templates (`%{varName}`)

**Key Generation Strategy**:
- MD5 hash based on file path + text content
- Ensures uniqueness across entire project
- Allows same text in different files to have different keys

**Translation Management**:
- Bi-directional Google Sheets synchronization
- Remote translations take priority during sync
- LLM-powered automatic translation for new keys
- Interactive unused key detection and cleanup
- Backup files created before key deletion

**Error Handling**:
- Comprehensive error types with contextual suggestions
- Interactive CLI prompts for user confirmations
- Graceful fallbacks (e.g., original text if translation fails)
- Progress indicators for long-running operations

**Development Workflow**:
- Version bumping integrated with git tagging
- Automatic npm publishing with validation
- Semantic versioning enforced
- Clean git state required for releases