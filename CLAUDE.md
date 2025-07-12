# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm run build        # Compile TypeScript to JavaScript in dist/
npm run test         # Run Jest tests
npm run dev          # Run scanner directly with ts-node
npm run scan         # Run compiled scanner from dist/
```

### Publishing
```bash
npm run publish:release    # Execute publish.sh script
npm run prepublishOnly     # Build before publishing (runs automatically)
```

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

The tool requires an `i18n.config.js` file in the project root with these key settings:
- `rootDir`: Directory to scan
- `languages`: Array of language codes
- `outputDir`: Where translation files are generated
- `spreadsheetId`: Google Sheets ID for remote sync
- `startMarker`/`endMarker`: Text markers (e.g., "~text~")
- `forceKeepKeys`: Keys to never delete even if unused
- `keyExpirationDays`: Number of days after which unused keys expire (optional, enables time-based detection)

### Text Processing Modes

1. **Marker Mode**: Text wrapped in configurable markers (e.g., `~Hello World~`)
2. **JSX Text Mode**: Pure text nodes in JSX elements (automatically detected)

### Translation Key Generation

- Uses MD5 hash based on file path and text content
- Ensures unique keys across the entire project
- Supports template strings with variable interpolation

### Data Flow

1. Scan files for marked text and JSX text nodes
2. Transform code to use I18n.t() calls
3. Generate translation files for each language
4. Sync with Google Sheets (bi-directional)
5. Analyze and clean unused keys (with backup)

### Demo Projects

- `demo/nextjs/` - Next.js integration example
- `demo/vite/` - Vite integration example

Both demos show real usage patterns and configuration setups.

## Migration Scripts

For existing projects that need to add time tracking to their i18n-complete-record.json files:

### Simple Migration
```bash
node scripts/migrate-add-timestamp.js
```
Adds current timestamp to all existing keys without `_lastUsed` field.

### Advanced Migration  
```bash
node scripts/migrate-advanced.js
```
Provides multiple migration strategies:
- `current`: Set all keys to current time (fresh start)
- `conservative`: Set keys to expired time to mark truly unused ones
- `staggered`: Distribute timestamps randomly to avoid mass expiration

**Note**: Migration scripts are independent and should be run manually before enabling time-based detection. The core application does not include automatic migration logic.

## Testing

Uses Jest for testing. Test files are excluded from TypeScript compilation but included in the test run.

## Important Notes

- The tool modifies source code files directly using jscodeshift
- Always creates backups before deleting unused keys
- Supports both local file generation and Google Sheets synchronization
- Includes interactive CLI for user confirmations
- Uses semantic versioning for releases