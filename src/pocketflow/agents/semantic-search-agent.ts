/**
 * Semantic Search Agent for PocketFlow integration
 */

import { BaseAgent } from './base-agent';
import { AgentContext, AgentResult, AgentConfig } from '../types';
import { SemanticSearch } from '../../semantic-search';
import { SearchOptions, SearchResult } from '../../types';

export class SemanticSearchAgent extends BaseAgent {
  private semanticSearch: SemanticSearch | null = null;
  private initialized: boolean = false;

  constructor(config: AgentConfig) {
    super(config);
  }

  /**
   * Initialize the semantic search service
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.semanticSearch = new SemanticSearch();
      await this.semanticSearch.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Semantic search initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main execution logic for semantic search
   */
  protected async run(context: AgentContext): Promise<AgentResult> {
    this.validateContext(context);

    if (!this.initialized) {
      await this.initialize();
    }

    const { query, options = {} } = context.input;

    if (!query || typeof query !== 'string') {
      return this.createErrorResult('Query must be a non-empty string');
    }

    try {
      // Perform semantic search
      const searchResult = await this.semanticSearch!.search(query, options);
      
      // Extract and format results
      const formattedResults = this.formatSearchResults(searchResult);
      
      return this.createSuccessResult(formattedResults, {
        query,
        resultCount: searchResult.resultCount,
        searchTime: searchResult.searchTime,
        language: options.language,
        topK: options.topK
      });

    } catch (error) {
      return this.createErrorResult(
        `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format search results for better consumption
   */
  private formatSearchResults(searchResult: SearchResult): any[] {
    return searchResult.results.map(result => ({
      content: result.content,
      filePath: result.filePath,
      language: result.language,
      type: result.type,
      lineStart: result.lineStart,
      lineEnd: result.lineEnd,
      similarity: result.similarity,
      timestamp: result.timestamp,
      excerpt: this.extractExcerpt(result.content, 200)
    }));
  }

  /**
   * Extract a meaningful excerpt from code content
   */
  private extractExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    // Try to extract a meaningful portion
    const lines = content.split('\n');
    let excerpt = '';
    let currentLength = 0;
    
    for (const line of lines) {
      if (currentLength + line.length + 1 > maxLength) {
        break;
      }
      excerpt += line + '\n';
      currentLength += line.length + 1;
    }
    
    return excerpt.trim() + (content.length > maxLength ? '...' : '');
  }

  /**
   * Perform advanced semantic search with multiple strategies
   */
  async performAdvancedSearch(context: AgentContext): Promise<AgentResult> {
    const { query, strategies = ['semantic', 'syntactic', 'contextual'] } = context.input;

    try {
      const results: any[] = [];
      
      if (strategies.includes('semantic')) {
        const semanticResult = await this.run(context);
        if (semanticResult.success) {
          results.push({ type: 'semantic', data: semanticResult.data });
        }
      }

      // Add other search strategies as needed
      if (strategies.includes('syntactic')) {
        // Implement syntactic search
        results.push({ type: 'syntactic', data: [] });
      }

      if (strategies.includes('contextual')) {
        // Implement contextual search
        results.push({ type: 'contextual', data: [] });
      }

      return this.createSuccessResult({
        query,
        strategies,
        results,
        totalResults: results.reduce((sum, r) => sum + (r.data?.length || 0), 0)
      });

    } catch (error) {
      return this.createErrorResult(
        `Advanced search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find related code patterns
   */
  async findRelatedPatterns(context: AgentContext): Promise<AgentResult> {
    const { currentFile, relationshipType = 'similar', contextWindow = 10 } = context.input;

    if (!currentFile) {
      return this.createErrorResult('Current file path is required');
    }

    try {
      // Build search query based on current file
      const query = `related patterns in ${currentFile}`;
      const options: SearchOptions = {
        filePath: currentFile,
        topK: contextWindow
      };

      const searchResult = await this.semanticSearch!.search(query, options);
      
      // Filter by relationship type
      let filteredResults = searchResult.results;
      
      if (relationshipType === 'dependent') {
        // Filter for dependencies (would need dependency analysis)
        filteredResults = filteredResults.filter(result => 
          result.type === 'import' || result.type === 'function'
        );
      } else if (relationshipType === 'referenced') {
        // Filter for references (would need reference analysis)
        filteredResults = filteredResults.filter(result => 
          result.similarity > 0.8
        );
      }

      return this.createSuccessResult({
        currentFile,
        relationshipType,
        relatedPatterns: filteredResults,
        resultCount: filteredResults.length,
        searchTime: searchResult.searchTime
      });

    } catch (error) {
      return this.createErrorResult(
        `Failed to find related patterns: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.semanticSearch) {
      await this.semanticSearch.close();
      this.semanticSearch = null;
    }
    this.initialized = false;
  }

  /**
   * Check if agent is ready
   */
  isAvailable(): boolean {
    return this.initialized && this.semanticSearch !== null;
  }
}