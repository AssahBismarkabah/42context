
import { logError } from '../core/logger';
import { SemanticSearch } from './semantic-search';
import { SearchResult } from '../core/types';

/**
 * Universal LLM Provider Interface - Supports any OpenAI-compatible API
 * This allows us to plug in different providers (OpenAI, Anthropic, local models, etc.)
 */

export interface LLMProviderConfig {
  provider: 'openai' | 'openrouter' | 'custom'; 
  apiKey: string;
  baseURL?: string; // For custom endpoints like OpenRouter, local models, Anthropic
  model?: string; // Model name (gpt-4, claude-3, etc.)
  maxTokens?: number;
  temperature?: number;
}

export interface LLMJudgmentRequest {
  query: string;
  candidates: Array<{
    code: string;
    filePath: string;
    similarity: number;
    metadata: Record<string, any>;
  }>;
  task: 'code_relevance' | 'implementation_detection' | 'relationship_analysis';
}

export interface LLMJudgmentResponse {
  selectedIndices: number[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  relationshipTypes?: ('implementation' | 'usage' | 'similar_logic' | 'related_concept')[];
  metadata?: Record<string, any>;
}

export interface LLMProvider {
  judgeRelevance(request: LLMJudgmentRequest): Promise<LLMJudgmentResponse>;
  isHealthy(): Promise<boolean>;
}

/**
 * Universal LLM Provider - OpenAI-Compatible API
 * Works with: OpenAI, OpenRouter, Anthropic (via OpenAI-compatible endpoints),
 * Local models (Ollama, LMStudio), Azure OpenAI, Groq, etc.
 *
 * The key insight: Most providers now offer OpenAI-compatible APIs
 * Anthropic: Use https://api.anthropic.com/v1 with custom headers (handled by baseURL)
 * Groq: Use https://api.groq.com/openai/v1
 * Ollama: Use http://localhost:11434/v1
 * LMStudio: Use http://localhost:1234/v1
 */
export class OpenAICompatibleProvider implements LLMProvider {
  private config: LLMProviderConfig;
  private baseURL: string;
  private model: string;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
  }

  async judgeRelevance(request: LLMJudgmentRequest): Promise<LLMJudgmentResponse> {
    try {
      const prompt = this.buildJudgmentPrompt(request);
      const response = await this.callLLM(prompt);
      return this.parseResponse(response, request.candidates.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('LLM judgment failed:', errorMessage);
      throw new Error(`LLM judgment failed: ${errorMessage}`);
    }
  }

  private buildJudgmentPrompt(request: LLMJudgmentRequest): string {
    const { query, candidates, task } = request;
    
    let taskDescription = '';
    let selectionCriteria = '';

    switch (task) {
      case 'code_relevance':
        taskDescription = 'Select the most relevant code snippets that best match the search query.';
        selectionCriteria = `
Relevance Criteria:
1. Functional similarity - Does the code actually do what the query asks?
2. Contextual appropriateness - Is this the right type of code for the query?
3. Semantic alignment - Does the code's purpose match the query intent?
4. Avoid false positives - Don't select code that just happens to have similar keywords`;
        break;
      
      case 'implementation_detection':
        taskDescription = 'Identify which classes/interfaces actually implement or extend the specified interface.';
        selectionCriteria = `
Implementation Criteria:
1. Actual inheritance - Does the class explicitly implement/extend the interface?
2. Method implementation - Does it provide concrete implementations of interface methods?
3. Type relationships - Is there a clear inheritance hierarchy?
4. Avoid name-only similarity - Don't select based on similar names alone`;
        break;
      
      case 'relationship_analysis':
        taskDescription = 'Analyze how the code snippets relate to each other and the query.';
        selectionCriteria = `
Relationship Criteria:
1. Usage relationships - Does one piece of code use/call another?
2. Similar logic - Do they solve similar problems in similar ways?
3. Conceptual relatedness - Are they conceptually connected?
4. Functional complementarity - Do they work together to achieve a goal?`;
        break;
    }

    return `You are an expert code analyst. Your task is to ${taskDescription}

Search Query: "${query}"

Code Candidates to Evaluate:
${candidates.map((candidate, index) => `
[${index}] File: ${candidate.filePath}
Similarity Score: ${candidate.similarity.toFixed(3)}
Code:
\`\`\`${candidate.metadata.language || 'java'}
${candidate.code}
\`\`\`
Metadata: ${JSON.stringify(candidate.metadata, null, 2)}
`).join('\n')}

${selectionCriteria}

Instructions:
1. Analyze each code snippet carefully against the query and criteria above
2. Select ONLY the indices (0-${candidates.length - 1}) of the most relevant snippets
3. Provide brief reasoning for each selection (1-2 sentences each)
4. Rate your overall confidence as high/medium/low
5. If no snippets are truly relevant, return an empty selection with low confidence

Output Format:
{
  "selectedIndices": [0, 2, 5],
  "confidence": "high",
  "reasoning": [
    "Index 0: This code directly implements JWT parsing which matches the query intent",
    "Index 2: Contains the specific JOSE parser logic requested",
    "Index 5: Provides complementary authentication functionality"
  ]
}`;
  }

  private async callLLM(prompt: string): Promise<string> {
    // Use fetch for maximum compatibility with different providers
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code analyst. Respond only with valid JSON in the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature || 0.1,
        max_tokens: this.config.maxTokens || 1000
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }

  private parseResponse(response: string, candidateCount: number): LLMJudgmentResponse {
    try {
      // Clean up the response - sometimes LLMs add extra formatting
      const cleanedResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);

      // Validate the response structure
      if (!parsed.selectedIndices || !Array.isArray(parsed.selectedIndices)) {
        throw new Error('Invalid response format: missing selectedIndices');
      }

      if (!parsed.confidence || !['high', 'medium', 'low'].includes(parsed.confidence)) {
        throw new Error('Invalid response format: missing or invalid confidence');
      }

      if (!parsed.reasoning || !Array.isArray(parsed.reasoning)) {
        throw new Error('Invalid response format: missing reasoning');
      }

      // Validate indices are within bounds
      const validIndices = parsed.selectedIndices.filter((index: number) => 
        index >= 0 && index < candidateCount
      );

      return {
        selectedIndices: validIndices,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        metadata: {
          originalResponse: response,
          validIndicesCount: validIndices.length,
          totalCandidates: candidateCount
        }
      };
    } catch (error) {
      logError('Failed to parse LLM response:', error instanceof Error ? error.message : String(error), response);
      // Fallback: return empty selection with low confidence
      return {
        selectedIndices: [],
        confidence: 'low',
        reasoning: ['Failed to parse LLM response, falling back to vector search results'],
        metadata: { error: error instanceof Error ? error.message : String(error), fallback: true }
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      logError('LLM provider health check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

/**
 * Factory function to create LLM provider - Universal approach
 * All providers use OpenAI-compatible API format
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  // Validate required fields
  if (!config.apiKey) {
    throw new Error('API key is required for LLM provider');
  }
  
  // Set appropriate defaults based on provider type
  const finalConfig: LLMProviderConfig = {
    ...config,
    baseURL: config.baseURL || getDefaultBaseURL(config.provider),
    model: config.model || getDefaultModel(config.provider)
  };
  
  return new OpenAICompatibleProvider(finalConfig);
}

/**
 * Get default base URL for different providers
 */
function getDefaultBaseURL(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'custom':
      // For custom, user must provide baseURL or it will use OpenAI default
      return 'https://api.openai.com/v1';
    default:
      return 'https://api.openai.com/v1';
  }
}

/**
 * Get default model for different providers
 */
function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-3.5-turbo';
    case 'openrouter':
      return 'openai/gpt-3.5-turbo'; // OpenRouter format
    case 'custom':
      return 'gpt-3.5-turbo';
    default:
      return 'gpt-3.5-turbo';
  }
}

/**
 * Enhanced Semantic Search with LLM Judgment
 * This is our DSPy-style implementation in TypeScript
 */
export class EnhancedSemanticSearch {
  private semanticSearch: SemanticSearch;
  private llmProvider: LLMProvider | undefined;
  private config: {
    useLLMJudgment: boolean;
    confidenceThreshold: number;
    maxLLMCandidates: number;
  };

  constructor(semanticSearch: SemanticSearch, llmProvider?: LLMProvider, config = {
    useLLMJudgment: true,
    confidenceThreshold: 0.7,
    maxLLMCandidates: 15
  }) {
    this.semanticSearch = semanticSearch;
    this.llmProvider = llmProvider;
    this.config = config;
  }

  /**
   * Enhanced search with optional LLM judgment
   * This implements the DSPy pattern: vector search + LLM judgment
   */
  async searchWithJudgment(
    query: string,
    options: {
      language?: string;
      topK?: number;
      minSimilarity?: number;
      useLLMJudgment?: boolean;
    } = {}
  ): Promise<SearchResult & { llmJudgment?: LLMJudgmentResponse }> {
    // Stage 1: Vector search (existing functionality)
    const searchOptions: any = {
      topK: options.topK ? options.topK * 3 : 30, // Get more candidates for LLM to judge
      minSimilarity: options.minSimilarity || 0.2
    };
    if (options.language) {
      searchOptions.language = options.language;
    }
    
    const initialResults = await this.semanticSearch.search(query, searchOptions);

    // If LLM judgment is disabled or no provider, return regular results
    if (!this.llmProvider || !this.config.useLLMJudgment || options.useLLMJudgment === false) {
      return initialResults;
    }

    // Stage 2: LLM judgment (DSPy-style enhancement)
    try {
      const llmRequest: LLMJudgmentRequest = {
        query,
        candidates: initialResults.results.map(result => ({
          code: result.content,
          filePath: result.filePath,
          similarity: result.similarity,
          metadata: {
            language: result.language,
            type: result.type,
            lineStart: result.lineStart,
            lineEnd: result.lineEnd
          }
        })),
        task: 'code_relevance'
      };

      const judgment = await this.llmProvider.judgeRelevance(llmRequest);

      // Apply LLM judgment to filter results
      const filteredResults = initialResults.results.filter((_, index) =>
        judgment.selectedIndices.includes(index)
      );

      // Sort by confidence and similarity
      filteredResults.sort((a, b) => {
        // Prioritize LLM-selected results, then by similarity
        const aSelected = judgment.selectedIndices.includes(initialResults.results.indexOf(a));
        const bSelected = judgment.selectedIndices.includes(initialResults.results.indexOf(b));
        
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return b.similarity - a.similarity;
      });

      // Limit to requested topK
      const finalResults = filteredResults.slice(0, options.topK || 10);

      return {
        ...initialResults,
        results: finalResults,
        resultCount: finalResults.length,
        llmJudgment: judgment
      };

    } catch (error) {
      logError('LLM judgment failed, falling back to vector search:', error);
      // Fallback to regular vector search if LLM fails
      return initialResults;
    }
  }

  /**
   * Set LLM provider for enhanced search
   */
  setLLMProvider(provider: LLMProvider | undefined): void {
    this.llmProvider = provider;
  }

  /**
   * Configure LLM judgment settings
   */
  configureLLM(options: {
    useLLMJudgment?: boolean;
    confidenceThreshold?: number;
    maxLLMCandidates?: number;
  }): void {
    this.config = { ...this.config, ...options };
  }
}