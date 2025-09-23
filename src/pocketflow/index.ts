/**
 * PocketFlow Integration Module for MCP Local Context Engine
 * 
 * This module provides the complete PocketFlow orchestration system for the MCP server,
 * enabling multi-agent workflows and advanced AI-powered code analysis.
 */

export * from './types';
export * from './config';
export * from './orchestrator';
export * from './integration';
export * from './agents/base-agent';
export * from './agents/semantic-search-agent';
export * from './agents/code-analysis-agent';

// Re-export main integration function for convenience
export { createPocketFlowMCPIntegration } from './integration';

// Export default configuration
export { DEFAULT_POCKETFLOW_CONFIG } from './config';