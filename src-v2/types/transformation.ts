/**
 * Code transformation related type definitions
 */

import { ExtractedContent } from './extraction';

/**
 * I18n call configuration
 */
export interface I18nCallConfig {
  /** Translation key */
  key: string;
  
  /** Variable mappings for interpolation */
  variables?: Record<string, any>;
  
  /** Element factories for JSX content */
  elementFactories?: Record<string, () => any>;
  
  /** I18n function name (default: 't') */
  functionName?: string;
  
  /** I18n object name (default: 'I18n') */
  objectName?: string;
}

/**
 * Transformation context
 */
export interface TransformationContext {
  /** File path */
  filePath: string;
  
  /** Original source code */
  source: string;
  
  /** Extracted contents to transform */
  extractedContents: ExtractedContent[];
  
  /** Transformation options */
  options: TransformationOptions;
}

/**
 * Transformation options
 */
export interface TransformationOptions {
  /** Whether to add I18n import automatically */
  addImport?: boolean;
  
  /** I18n import path */
  importPath?: string;
  
  /** Whether to preserve original formatting */
  preserveFormatting?: boolean;
  
  /** Maximum line length for generated code */
  maxLineLength?: number;
  
  /** Indentation size */
  indentSize?: number;
  
  /** Use tabs vs spaces */
  useTabs?: boolean;
}

/**
 * AST transformation result
 */
export interface ASTTransformationResult {
  /** Whether transformation was successful */
  success: boolean;
  
  /** Transformed AST node */
  node?: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Number of modifications made */
  modifications: number;
}

/**
 * Template variable info
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'jsx-element';
  
  /** Placeholder in translation */
  placeholder: string;
  
  /** Original expression */
  expression?: string;
}

/**
 * Transformation failure information
 */
export interface TransformFailure {
  /** Error type */
  type: 'TRANSFORM_ERROR' | 'SYNTAX_ERROR' | 'IMPORT_ERROR' | 'UNKNOWN';
  
  /** Error message */
  message: string;
  
  /** File path where failure occurred */
  filePath: string;
  
  /** Content that failed to transform */
  content?: string;
  
  /** Additional error details */
  details?: any;
  
  /** Stack trace if available */
  stack?: string;
}