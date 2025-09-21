/**
 * Base Agent class for PocketFlow integration
 */

import { AgentContext, AgentResult, AgentConfig, AgentType } from '../types';
import { PocketFlowConfigManager } from '../config';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected agentType: AgentType;
  protected maxRetries: number;
  protected timeout: number;
  protected retryCount: number = 0;
  protected startTime: number = 0;

  constructor(config: AgentConfig) {
    this.config = config;
    this.agentType = config.type;
    this.maxRetries = config.retryAttempts;
    this.timeout = config.timeout * 1000; // Convert to milliseconds
  }

  /**
   * Main execution method that handles retry logic and timeout
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    this.startTime = Date.now();
    this.retryCount = context.retryCount || 0;

    try {
      // Check if we've exceeded max retries
      if (this.retryCount >= this.maxRetries) {
        return this.createErrorResult(`Max retries (${this.maxRetries}) exceeded`);
      }

      // Execute the agent's specific logic
      const result = await this.run(context);
      
      return {
        ...result,
        executionTime: Date.now() - this.startTime,
        retryCount: this.retryCount
      };

    } catch (error) {
      // If we haven't exceeded max retries, return error for retry
      if (this.retryCount < this.maxRetries) {
        return this.createErrorResult(
          `Agent failed: ${error instanceof Error ? error.message : String(error)}`,
          true // retryable
        );
      }
      
      // Max retries exceeded, return final error
      return this.createErrorResult(
        `Agent failed after ${this.maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`,
        false // not retryable
      );
    }
  }

  /**
   * Abstract method that each agent must implement
   */
  protected abstract run(context: AgentContext): Promise<AgentResult>;

  /**
   * Create a successful result
   */
  protected createSuccessResult(data: any, metadata: Record<string, any> = {}): AgentResult {
    return {
      success: true,
      data,
      metadata: {
        agentType: this.agentType,
        agentName: this.config.name,
        executionTime: Date.now() - this.startTime,
        ...metadata
      },
      executionTime: Date.now() - this.startTime,
      retryCount: this.retryCount
    };
  }

  /**
   * Create an error result
   */
  protected createErrorResult(error: string, retryable: boolean = false): AgentResult {
    return {
      success: false,
      error,
      metadata: {
        agentType: this.agentType,
        agentName: this.config.name,
        executionTime: Date.now() - this.startTime,
        retryable,
        maxRetries: this.maxRetries,
        currentRetry: this.retryCount
      },
      executionTime: Date.now() - this.startTime,
      retryCount: this.retryCount
    };
  }

  /**
   * Validate input context
   */
  protected validateContext(context: AgentContext): boolean {
    if (!context.taskId) {
      throw new Error('Task ID is required');
    }
    if (!context.input) {
      throw new Error('Input is required');
    }
    return true;
  }

  /**
   * Check if execution has timed out
   */
  protected isTimedOut(): boolean {
    const elapsedTime = Date.now() - this.startTime;
    return elapsedTime > this.timeout;
  }

  /**
   * Get agent information
   */
  getAgentInfo(): AgentConfig {
    return this.config;
  }

  /**
   * Get agent type
   */
  getAgentType(): AgentType {
    return this.agentType;
  }

  /**
   * Check if agent is available for work
   */
  isAvailable(): boolean {
    // Base implementation - can be overridden by specific agents
    return true;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Base implementation - can be overridden by specific agents
  }
}

/**
 * Agent factory interface
 */
export interface AgentFactory {
  createAgent(agentType: AgentType): BaseAgent;
}

/**
 * Base agent factory
 */
export class BaseAgentFactory implements AgentFactory {
  protected configManager: PocketFlowConfigManager;

  constructor(configManager: PocketFlowConfigManager) {
    this.configManager = configManager;
  }

  createAgent(agentType: AgentType): BaseAgent {
    const config = this.configManager.getAgentConfig(agentType);
    
    // Use config to avoid unused variable warning
    console.log(`Creating agent ${agentType} with config:`, config.name);
    
    // This should be implemented by specific factories
    throw new Error(`Agent type ${agentType} not implemented in base factory`);
  }
}