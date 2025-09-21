/**
 * PocketFlow Integration Types for MCP Local Context Engine
 */

import { VectorSearchResult } from '../types';

export interface PocketFlowConfig {
  orchestrator: 'local' | 'distributed';
  maxAgents: number;
  workflowTimeout: number; // seconds
  enableParallelExecution: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
  agentConfigs: Record<string, AgentConfig>;
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  maxConcurrentTasks: number;
  timeout: number; // seconds
  retryAttempts: number;
  specialized: boolean;
  modelPreference?: string;
}

export type AgentType = 
  | 'code_analysis'
  | 'semantic_search' 
  | 'documentation'
  | 'security_scan'
  | 'code_quality'
  | 'architecture_analysis'
  | 'debug_assistance'
  | 'refactor_suggestion'
  | 'test_generation';

export interface AgentContext {
  taskId: string;
  agentType: AgentType;
  input: any;
  metadata: Record<string, any>;
  timestamp: number;
  retryCount: number;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: Record<string, any>;
  executionTime: number;
  retryCount: number;
}

export interface WorkflowContext {
  query: string;
  filePath?: string;
  language?: string;
  analysisType?: string;
  topK?: number;
  minSimilarity?: number;
  projectPath?: string;
  [key: string]: any;
}

export interface WorkflowResult {
  success: boolean;
  results: Record<string, AgentResult>;
  workflowTime: number;
  totalAgents: number;
  failedAgents: string[];
}

export interface CodeSearchWorkflowResult {
  searchResults: VectorSearchResult[];
  analysisResults?: any[];
  documentation?: string[];
  relatedPatterns?: any[];
  executionTime: number;
  confidence: number;
}

export interface AnalysisWorkflowResult {
  complexity?: any;
  dependencies?: any[];
  patterns?: any[];
  securityIssues?: any[];
  qualityMetrics?: any;
  suggestions?: string[];
  executionTime: number;
  confidence: number;
}

export interface TaskDelegationConfig {
  taskType: string;
  preferredAgent?: AgentType;
  fallbackAgents: AgentType[];
  priority: number;
  timeout: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
}

export interface ErrorHandlingConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  fallbackToSimpleSearch: boolean;
  errorLogging: boolean;
  circuitBreaker: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}