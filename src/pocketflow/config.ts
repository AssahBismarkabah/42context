/**
 * PocketFlow Configuration for MCP Local Context Engine
 */

import { ConfigManager } from '../core/config';
import { 
  PocketFlowConfig, 
  AgentConfig, 
  AgentType,
  ErrorHandlingConfig,
  RetryPolicy,
  // CircuitBreakerConfig // Commented out for now
} from './types';

export interface PocketFlowIntegrationConfig {
  pocketflow: PocketFlowConfig;
}

// Default PocketFlow configuration
export const DEFAULT_POCKETFLOW_CONFIG: PocketFlowConfig = {
  orchestrator: 'local',
  maxAgents: 10,
  workflowTimeout: 300, // 5 minutes
  enableParallelExecution: true,
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  agentConfigs: {
    code_analysis: {
      name: 'CodeAnalysisAgent',
      type: 'code_analysis',
      maxConcurrentTasks: 3,
      timeout: 60, // 1 minute
      retryAttempts: 2,
      specialized: true,
      modelPreference: 'Xenova/all-MiniLM-L6-v2'
    },
    semantic_search: {
      name: 'SemanticSearchAgent',
      type: 'semantic_search',
      maxConcurrentTasks: 5,
      timeout: 30, // 30 seconds
      retryAttempts: 2,
      specialized: true,
      modelPreference: 'Xenova/all-MiniLM-L6-v2'
    },
    documentation: {
      name: 'DocumentationAgent',
      type: 'documentation',
      maxConcurrentTasks: 2,
      timeout: 45, // 45 seconds
      retryAttempts: 1,
      specialized: true
    },
    security_scan: {
      name: 'SecurityAnalysisAgent',
      type: 'security_scan',
      maxConcurrentTasks: 2,
      timeout: 90, // 1.5 minutes
      retryAttempts: 1,
      specialized: true
    },
    code_quality: {
      name: 'CodeQualityAgent',
      type: 'code_quality',
      maxConcurrentTasks: 2,
      timeout: 60, // 1 minute
      retryAttempts: 1,
      specialized: true
    },
    architecture_analysis: {
      name: 'ArchitectureAnalysisAgent',
      type: 'architecture_analysis',
      maxConcurrentTasks: 1,
      timeout: 120, // 2 minutes
      retryAttempts: 1,
      specialized: true
    },
    debug_assistance: {
      name: 'DebugAssistanceAgent',
      type: 'debug_assistance',
      maxConcurrentTasks: 2,
      timeout: 60, // 1 minute
      retryAttempts: 2,
      specialized: true
    },
    refactor_suggestion: {
      name: 'RefactorSuggestionAgent',
      type: 'refactor_suggestion',
      maxConcurrentTasks: 1,
      timeout: 90, // 1.5 minutes
      retryAttempts: 1,
      specialized: true
    },
    test_generation: {
      name: 'TestGenerationAgent',
      type: 'test_generation',
      maxConcurrentTasks: 2,
      timeout: 60, // 1 minute
      retryAttempts: 1,
      specialized: true
    }
  }
};

export const DEFAULT_ERROR_HANDLING_CONFIG: ErrorHandlingConfig = {
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  fallbackToSimpleSearch: true,
  errorLogging: true,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenRequests: 3
  }
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2
};

/**
 * PocketFlow configuration manager
 */
export class PocketFlowConfigManager {
  private config: PocketFlowConfig;
  private errorHandlingConfig: ErrorHandlingConfig;

  constructor(private configManager: ConfigManager) {
    this.config = this.loadPocketFlowConfig();
    this.errorHandlingConfig = this.loadErrorHandlingConfig();
  }

  private loadPocketFlowConfig(): PocketFlowConfig {
    // Check for PocketFlow-specific environment variables
    const env = process.env;
    
    const config: PocketFlowConfig = {
      ...DEFAULT_POCKETFLOW_CONFIG,
      maxAgents: env.DEV_CONTEXT_MAX_AGENTS ? 
        parseInt(env.DEV_CONTEXT_MAX_AGENTS) : 
        DEFAULT_POCKETFLOW_CONFIG.maxAgents,
      workflowTimeout: env.DEV_CONTEXT_WORKFLOW_TIMEOUT ? 
        parseInt(env.DEV_CONTEXT_WORKFLOW_TIMEOUT) : 
        DEFAULT_POCKETFLOW_CONFIG.workflowTimeout,
      maxRetries: env.DEV_CONTEXT_MAX_RETRIES ? 
        parseInt(env.DEV_CONTEXT_MAX_RETRIES) : 
        DEFAULT_POCKETFLOW_CONFIG.maxRetries,
      retryDelay: env.DEV_CONTEXT_RETRY_DELAY ? 
        parseInt(env.DEV_CONTEXT_RETRY_DELAY) : 
        DEFAULT_POCKETFLOW_CONFIG.retryDelay,
      enableParallelExecution: env.DEV_CONTEXT_ENABLE_PARALLEL_EXECUTION !== 'false',
      orchestrator: (env.DEV_CONTEXT_ORCHESTRATOR as 'local' | 'distributed') || 'local'
    };

    this.validatePocketFlowConfig(config);
    return config;
  }

  private loadErrorHandlingConfig(): ErrorHandlingConfig {
    const env = process.env;
    
    return {
      ...DEFAULT_ERROR_HANDLING_CONFIG,
      enableRetry: env.DEV_CONTEXT_ENABLE_RETRY !== 'false',
      maxRetries: env.DEV_CONTEXT_ERROR_MAX_RETRIES ? 
        parseInt(env.DEV_CONTEXT_ERROR_MAX_RETRIES) : 
        DEFAULT_ERROR_HANDLING_CONFIG.maxRetries,
      retryDelay: env.DEV_CONTEXT_ERROR_RETRY_DELAY ? 
        parseInt(env.DEV_CONTEXT_ERROR_RETRY_DELAY) : 
        DEFAULT_ERROR_HANDLING_CONFIG.retryDelay,
      fallbackToSimpleSearch: env.DEV_CONTEXT_FALLBACK_TO_SIMPLE_SEARCH !== 'false',
      errorLogging: env.DEV_CONTEXT_ERROR_LOGGING !== 'false',
      circuitBreaker: {
        ...DEFAULT_ERROR_HANDLING_CONFIG.circuitBreaker,
        enabled: env.DEV_CONTEXT_CIRCUIT_BREAKER_ENABLED !== 'false',
        failureThreshold: env.DEV_CONTEXT_CIRCUIT_BREAKER_THRESHOLD ? 
          parseInt(env.DEV_CONTEXT_CIRCUIT_BREAKER_THRESHOLD) : 
          DEFAULT_ERROR_HANDLING_CONFIG.circuitBreaker.failureThreshold,
        resetTimeout: env.DEV_CONTEXT_CIRCUIT_BREAKER_RESET_TIMEOUT ? 
          parseInt(env.DEV_CONTEXT_CIRCUIT_BREAKER_RESET_TIMEOUT) : 
          DEFAULT_ERROR_HANDLING_CONFIG.circuitBreaker.resetTimeout
      }
    };
  }

  private validatePocketFlowConfig(config: PocketFlowConfig): void {
    if (config.maxAgents <= 0) {
      throw new Error('Max agents must be positive');
    }
    if (config.workflowTimeout <= 0) {
      throw new Error('Workflow timeout must be positive');
    }
    if (config.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }
    if (config.retryDelay < 0) {
      throw new Error('Retry delay cannot be negative');
    }
  }

  getPocketFlowConfig(): PocketFlowConfig {
    return this.config;
  }

  getErrorHandlingConfig(): ErrorHandlingConfig {
    return this.errorHandlingConfig;
  }

  getAgentConfig(agentType: AgentType): AgentConfig {
    const config = this.config.agentConfigs[agentType];
    if (!config) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
    return config;
  }

  getMaxAgents(): number {
    return this.config.maxAgents;
  }

  getWorkflowTimeout(): number {
    return this.config.workflowTimeout;
  }

  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  getRetryDelay(): number {
    return this.config.retryDelay;
  }

  isParallelExecutionEnabled(): boolean {
    return this.config.enableParallelExecution;
  }

  getOrchestratorType(): 'local' | 'distributed' {
    return this.config.orchestrator;
  }

  updateConfig(updates: Partial<PocketFlowConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validatePocketFlowConfig(this.config);
  }

  /**
   * Get the underlying config manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}

// Global PocketFlow config manager instance
let globalPocketFlowConfigManager: PocketFlowConfigManager | null = null;

export function createPocketFlowConfigManager(configManager: ConfigManager): PocketFlowConfigManager {
  return new PocketFlowConfigManager(configManager);
}

export function setGlobalPocketFlowConfigManager(configManager: PocketFlowConfigManager): void {
  globalPocketFlowConfigManager = configManager;
}

export function getGlobalPocketFlowConfigManager(): PocketFlowConfigManager {
  if (!globalPocketFlowConfigManager) {
    throw new Error('PocketFlow config manager not initialized');
  }
  return globalPocketFlowConfigManager;
}