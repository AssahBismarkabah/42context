/**
 * PocketFlow Integration for MCP Server
 * 
 * This module provides the bridge between PocketFlow orchestration and MCP tools,
 * enabling multi-agent workflows through the Model Context Protocol.
 */

import { PocketFlowOrchestrator } from './orchestrator';
import { PocketFlowConfigManager, createPocketFlowConfigManager } from './config';
import {
  WorkflowContext,
  CodeSearchWorkflowResult,
  AnalysisWorkflowResult,
  AgentContext
} from './types';
import { Logger, LogLevel, createLogger } from '../logger';
import { ConfigManager } from '../config';

/**
 * PocketFlow MCP Integration Manager
 */
export class PocketFlowMCPIntegration {
  private orchestrator: PocketFlowOrchestrator;
  private configManager: PocketFlowConfigManager;
  private isInitialized: boolean = false;
  private logger: Logger;

  constructor(configManager: ConfigManager) {
    this.logger = createLogger({ level: LogLevel.INFO, enableConsole: true });
    this.configManager = createPocketFlowConfigManager(configManager);
    this.orchestrator = new PocketFlowOrchestrator(this.configManager);
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing PocketFlow MCP Integration...');
      
      // Configuration manager is already initialized in constructor
      
      // Initialize orchestrator
      await this.orchestrator.initialize();
      
      this.isInitialized = true;
      this.logger.info('PocketFlow MCP Integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PocketFlow MCP Integration:', error);
      throw error;
    }
  }

  /**
   * Handle code search MCP tool request
   */
  async handleCodeSearch(params: any): Promise<CodeSearchWorkflowResult> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow MCP Integration not initialized');
    }

    try {
      this.logger.info(`Handling code search request: ${params.query}`);

      // Create workflow context
      const context: WorkflowContext = {
        query: params.query,
        language: params.language,
        topK: params.top_k || 10,
        minSimilarity: params.min_similarity || 0.7,
        filePath: params.file_path,
        includePatternAnalysis: params.include_pattern_analysis || false,
        detailLevel: params.detail_level || 'detailed'
      };

      // Execute workflow through orchestrator
      const result = await this.orchestrator.executeCodeSearchWorkflow(context);

      this.logger.info(`Code search completed in ${result.executionTime}ms with ${result.searchResults.length} results`);
      
      return result;

    } catch (error) {
      this.logger.error('Code search failed:', error);
      throw new Error(`Code search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle context analysis MCP tool request
   */
  async handleContextAnalysis(params: any): Promise<AnalysisWorkflowResult> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow MCP Integration not initialized');
    }

    try {
      this.logger.info(`Handling context analysis request for file: ${params.file_path}`);

      // Create workflow context
      const context: WorkflowContext = {
        query: '', // Not used for analysis
        filePath: params.file_path,
        analysisType: params.analysis_type || 'complexity',
        detailLevel: params.detail_level || 'detailed',
        includeRelatedFiles: params.include_related_files || false,
        focusAreas: params.focus_areas || []
      };

      // Execute workflow through orchestrator
      const result = await this.orchestrator.executeCodeAnalysisWorkflow(context);

      this.logger.info(`Context analysis completed in ${result.executionTime}ms`);
      
      return result;

    } catch (error) {
      this.logger.error('Context analysis failed:', error);
      throw new Error(`Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle semantic completion MCP tool request
   */
  async handleSemanticCompletion(params: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow MCP Integration not initialized');
    }

    try {
      this.logger.info(`Handling semantic completion request`);

      // Create agent context for semantic completion
      const context: AgentContext = {
        taskId: `completion_${Date.now()}`,
        agentType: 'semantic_search',
        input: {
          codeSnippet: params.code_snippet,
          options: {
            completionType: params.completion_type || 'function',
            language: params.language,
            contextWindow: params.context_window || 10
          }
        },
        metadata: {},
        timestamp: Date.now(),
        retryCount: 0
      };

      // Execute through semantic search agent
      const result = await this.orchestrator.executeAgent('semantic_search', context);

      if (!result.success) {
        throw new Error(`Semantic completion failed: ${result.error}`);
      }

      this.logger.info('Semantic completion completed successfully');
      
      return {
        completions: result.data?.completions || [],
        suggestions: result.data?.suggestions || [],
        confidence: 0.5 // Default confidence since AgentResult doesn't have confidence field
      };

    } catch (error) {
      this.logger.error('Semantic completion failed:', error);
      throw new Error(`Semantic completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle test suggestion MCP tool request
   */
  async handleTestSuggestion(params: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow MCP Integration not initialized');
    }

    try {
      this.logger.info(`Handling test suggestion request for function: ${params.function_name}`);

      // Create agent context for test suggestion
      const context: AgentContext = {
        taskId: `test_suggestion_${Date.now()}`,
        agentType: 'code_analysis',
        input: {
          functionName: params.function_name,
          filePath: params.file_path,
          options: {
            testFramework: params.test_framework || 'jest',
            testType: params.test_type || 'unit',
            coverageTarget: params.coverage_target || 80
          }
        },
        metadata: {},
        timestamp: Date.now(),
        retryCount: 0
      };

      // Execute through code analysis agent
      const result = await this.orchestrator.executeAgent('code_analysis', context);

      if (!result.success) {
        throw new Error(`Test suggestion failed: ${result.error}`);
      }

      this.logger.info('Test suggestion completed successfully');
      
      return {
        testCases: result.data?.testCases || [],
        testFramework: result.data?.testFramework || params.test_framework || 'jest',
        coverageAnalysis: result.data?.coverageAnalysis || {},
        confidence: 0.5 // Default confidence since AgentResult doesn't have confidence field
      };

    } catch (error) {
      this.logger.error('Test suggestion failed:', error);
      throw new Error(`Test suggestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get integration status
   */
  getStatus(): { 
    initialized: boolean; 
    orchestratorStatus: any; 
    configStatus: any; 
  } {
    return {
      initialized: this.isInitialized,
      orchestratorStatus: this.orchestrator.getStatus(),
      configStatus: { initialized: true } // Simple status for config manager
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.orchestrator.cleanup();
      this.isInitialized = false;
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}

/**
 * Create and initialize PocketFlow MCP Integration
 */
export async function createPocketFlowMCPIntegration(configManager: ConfigManager): Promise<PocketFlowMCPIntegration> {
  const integration = new PocketFlowMCPIntegration(configManager);
  await integration.initialize();
  return integration;
}