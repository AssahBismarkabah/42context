
/**
 * PocketFlow Orchestrator for MCP Local Context Engine
 */

import {
  AgentContext,
  AgentResult,
  WorkflowContext,
  CodeSearchWorkflowResult,
  AnalysisWorkflowResult,
  AgentType
} from './types';
import { PocketFlowConfigManager } from './config';
import { BaseAgent } from './agents/base-agent';
import { SemanticSearchAgent } from './agents/semantic-search-agent';
import { CodeAnalysisAgent } from './agents/code-analysis-agent';

/**
 * PocketFlow Orchestrator that manages multi-agent workflows
 */
export class PocketFlowOrchestrator {
  private configManager: PocketFlowConfigManager;
  private agents: Map<AgentType, BaseAgent> = new Map();
  private isInitialized: boolean = false;

  constructor(configManager: PocketFlowConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Initialize the orchestrator and all agents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.initializeAgents();
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initialize all configured agents
   */
  private async initializeAgents(): Promise<void> {
    const config = this.configManager.getPocketFlowConfig();
    
    for (const [agentType, agentConfig] of Object.entries(config.agentConfigs)) {
      try {
        const agent = this.createAgent(agentType as AgentType, agentConfig);
        this.agents.set(agentType as AgentType, agent);
      } catch (error) {
        // Continue with other agents even if one fails
      }
    }
  }

  /**
   * Create a specific agent instance
   */
  private createAgent(agentType: AgentType, config: any): BaseAgent {
    switch (agentType) {
      case 'semantic_search':
        return new SemanticSearchAgent(config);
      case 'code_analysis':
        return new CodeAnalysisAgent(config);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  /**
   * Execute code search workflow
   */
  async executeCodeSearchWorkflow(context: WorkflowContext): Promise<CodeSearchWorkflowResult> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow Orchestrator not initialized');
    }

    const startTime = Date.now();
    
    try {
      const searchAgent = this.agents.get('semantic_search');
      if (!searchAgent) {
        throw new Error('Semantic search agent not available');
      }

      const searchContext: AgentContext = {
        taskId: `search_${Date.now()}`,
        agentType: 'semantic_search',
        input: {
          query: context.query,
          options: {
            language: context.language,
            topK: context.topK || 10,
            minSimilarity: context.minSimilarity || 0.7
          }
        },
        metadata: {},
        timestamp: Date.now(),
        retryCount: 0
      };

      const searchResult = await searchAgent.execute(searchContext);
      
      if (!searchResult.success) {
        throw new Error(`Search failed: ${searchResult.error}`);
      }

      // Step 2: Pattern analysis (optional)
      let patternResults = null;
      if (context.includePatternAnalysis) {
        const analysisAgent = this.agents.get('code_analysis');
        if (analysisAgent) {
          const analysisContext: AgentContext = {
            taskId: `patterns_${Date.now()}`,
            agentType: 'code_analysis',
            input: {
              filePath: context.filePath || '',
              options: {
                analysisType: 'patterns',
                detailLevel: 'brief'
              }
            },
            metadata: { searchResults: searchResult.data },
            timestamp: Date.now(),
            retryCount: 0
          };
          
          patternResults = await analysisAgent.execute(analysisContext);
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        searchResults: searchResult.data?.results || [],
        analysisResults: patternResults?.data ? [patternResults.data] : [],
        documentation: [],
        relatedPatterns: [],
        executionTime,
        confidence: this.calculateConfidence(searchResult)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute code analysis workflow
   */
  async executeCodeAnalysisWorkflow(context: WorkflowContext): Promise<AnalysisWorkflowResult> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow Orchestrator not initialized');
    }

    const startTime = Date.now();
    const results: any = {};
    
    try {
      const analysisAgent = this.agents.get('code_analysis');
      if (!analysisAgent) {
        throw new Error('Code analysis agent not available');
      }

      // Execute different types of analysis in parallel
      const analysisPromises = [];

      // Complexity analysis
      if (!context.analysisType || context.analysisType === 'complexity') {
        analysisPromises.push(
          this.executeAnalysisTask(analysisAgent, context.filePath!, 'complexity', context)
        );
      }

      // Dependency analysis
      if (!context.analysisType || context.analysisType === 'dependencies') {
        analysisPromises.push(
          this.executeAnalysisTask(analysisAgent, context.filePath!, 'dependencies', context)
        );
      }

      // Pattern analysis
      if (!context.analysisType || context.analysisType === 'patterns') {
        analysisPromises.push(
          this.executeAnalysisTask(analysisAgent, context.filePath!, 'patterns', context)
        );
      }

      // Security analysis
      if (!context.analysisType || context.analysisType === 'security') {
        analysisPromises.push(
          this.executeAnalysisTask(analysisAgent, context.filePath!, 'security', context)
        );
      }

      // Quality analysis
      if (!context.analysisType || context.analysisType === 'quality') {
        analysisPromises.push(
          this.executeAnalysisTask(analysisAgent, context.filePath!, 'quality', context)
        );
      }

      // Wait for all analyses to complete
      const analysisResults = await Promise.allSettled(analysisPromises);

      // Process results
      analysisResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          const analysisType = this.getAnalysisTypeFromIndex(index, context);
          results[analysisType] = result.value.data;
        }
      });

      const executionTime = Date.now() - startTime;

      return {
        complexity: results.complexity,
        dependencies: results.dependencies,
        patterns: results.patterns,
        securityIssues: results.security,
        qualityMetrics: results.quality,
        suggestions: this.extractSuggestions(results),
        executionTime,
        confidence: this.calculateAnalysisConfidence(results)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute a specific analysis task
   */
  private async executeAnalysisTask(
    agent: BaseAgent, 
    filePath: string, 
    analysisType: string, 
    context: WorkflowContext
  ): Promise<AgentResult> {
    const agentContext: AgentContext = {
      taskId: `${analysisType}_${Date.now()}`,
      agentType: 'code_analysis',
      input: {
        filePath: filePath,
        options: {
          analysisType: analysisType,
          detailLevel: context.detailLevel || 'detailed',
          includeRelatedFiles: context.includeRelatedFiles || false,
          focusAreas: context.focusAreas || []
        }
      },
      metadata: {},
      timestamp: Date.now(),
      retryCount: 0
    };

    return await agent.execute(agentContext);
  }

  /**
   * Get analysis type from index
   */
  private getAnalysisTypeFromIndex(index: number, _context: WorkflowContext): string {
    const analysisTypes = ['complexity', 'dependencies', 'patterns', 'security', 'quality'];
    return analysisTypes[index] || 'unknown';
  }

  /**
   * Extract suggestions from analysis results
   */
  private extractSuggestions(results: any): string[] {
    const suggestions: string[] = [];
    
    // Extract suggestions from different analysis types
    if (results.quality?.improvementSuggestions) {
      suggestions.push(...results.quality.improvementSuggestions);
    }
    
    if (results.security?.recommendations) {
      suggestions.push(...results.security.recommendations);
    }
    
    if (results.patterns?.bestPractices) {
      suggestions.push(...results.patterns.bestPractices);
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Execute a specific agent task
   */
  async executeAgent(agentType: AgentType, context: AgentContext): Promise<AgentResult> {
    if (!this.isInitialized) {
      throw new Error('PocketFlow Orchestrator not initialized');
    }

    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent ${agentType} not available`);
    }

    return await agent.execute(context);
  }

  /**
   * Calculate confidence score for search results
   */
  private calculateConfidence(searchResult: AgentResult): number {
    if (!searchResult.success || !searchResult.data?.results) {
      return 0.0;
    }

    const results = searchResult.data.results;
    if (results.length === 0) {
      return 0.0;
    }

    // Calculate average similarity score
    const avgSimilarity = results.reduce((sum: number, result: any) => {
      return sum + (result.similarity || 0);
    }, 0) / results.length;

    // Normalize to 0-1 range
    return Math.min(avgSimilarity, 1.0);
  }

  /**
   * Calculate confidence score for analysis results
   */
  private calculateAnalysisConfidence(results: any): number {
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Check each analysis type for confidence scores
    if (results.complexity?.confidence) {
      totalConfidence += results.complexity.confidence;
      confidenceCount++;
    }

    if (results.quality?.confidence) {
      totalConfidence += results.quality.confidence;
      confidenceCount++;
    }

    if (results.patterns?.confidence) {
      totalConfidence += results.patterns.confidence;
      confidenceCount++;
    }

    if (results.security?.confidence) {
      totalConfidence += results.security.confidence;
      confidenceCount++;
    }

    return confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;
  }

  /**
   * Get orchestrator status
   */
  getStatus(): { initialized: boolean; agentCount: number; agents: string[] } {
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys())
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    for (const [, agent] of this.agents) {
      try {
        if (agent.cleanup) {
          await agent.cleanup();
        }
      } catch (error) {
        // Silently handle cleanup errors
      }
    }

    this.agents.clear();
    this.isInitialized = false;
  }
}