/**
 * Core operation type definitions
 */

import { ExtractionResult } from './extraction';
import { TransformFailure } from './transformation';

/**
 * Main operation result types
 */
export interface OperationResult {
  /** Whether operation was successful */
  success: boolean;
  
  /** Error information if failed */
  error?: OperationError;
  
  /** Operation-specific data */
  data?: any;
}

/**
 * Operation error information
 */
export interface OperationError {
  /** Error type */
  type: string;
  
  /** Error message */
  message: string;
  
  /** File path where error occurred */
  filePath?: string;
  
  /** Additional error details */
  details?: any;
  
  /** Stack trace if available */
  stack?: string;
}

/**
 * Code transformation result
 */
export interface CodeTransformationResult extends OperationResult {
  /** Transformed source code */
  transformedSource: string;
  
  /** Number of modifications made */
  modifiedCount: number;
  
  /** Total matched items */
  totalMatched: number;
  
  /** Number of items skipped */
  skippedCount: number;
  
  /** File path */
  filePath: string;
  
  /** Extraction summaries */
  extractionSummaries?: ExtractionSummary[];
  
  /** Transformation failures */
  failures?: TransformFailure[];
}

/**
 * Extraction summary information
 */
export interface ExtractionSummary {
  /** Original text */
  originalText: string;
  
  /** Generated translation key */
  key: string;
  
  /** Whether content has variables */
  hasVariables: boolean;
  
  /** Complexity level */
  complexityLevel: string;
}

/**
 * Scanner result
 */
export interface ScannerResult extends OperationResult {
  /** Number of files processed */
  filesProcessed: number;
  
  /** Number of files with transformations */
  filesTransformed: number;
  
  /** Total extractions across all files */
  totalExtractions: number;
  
  /** Transformation results per file */
  fileResults: CodeTransformationResult[];
}

/**
 * File processing result
 */
export interface FileProcessingResult extends OperationResult {
  /** File path */
  filePath: string;
  
  /** Whether file was modified */
  wasModified: boolean;
  
  /** Extraction results */
  extractionResults?: ExtractionResult[];
  
  /** Transformation result */
  transformationResult?: CodeTransformationResult;
}

/**
 * Batch processing options
 */
export interface BatchProcessingOptions {
  /** Whether to continue on error */
  continueOnError?: boolean;
  
  /** Maximum concurrent files to process */
  maxConcurrency?: number;
  
  /** Whether to create backups */
  createBackups?: boolean;
  
  /** Output directory for reports */
  reportDir?: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Progress information
 */
export interface ProgressInfo {
  /** Current operation */
  current: string;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Items processed */
  processed: number;
  
  /** Total items */
  total: number;
  
  /** Current file path */
  currentFile?: string;
  
  /** Estimated time remaining (ms) */
  eta?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error type */
  type: string;
  
  /** Error message */
  message: string;
  
  /** File path */
  filePath?: string;
  
  /** Line number */
  line?: number;
  
  /** Column number */
  column?: number;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning type */
  type: string;
  
  /** Warning message */
  message: string;
  
  /** File path */
  filePath?: string;
  
  /** Line number */
  line?: number;
  
  /** Column number */
  column?: number;
}