/**
 * Embedding Service for generating vector representations of code chunks
 * Uses local models for privacy-first semantic search with advanced memory management
 */

import { CodeChunk, EmbeddingResult as BaseEmbeddingResult } from './types';
import { MemoryManager } from './memory-manager';
import { MemoryConfigManager } from './memory-config';
import { EmbeddingOptimizer } from './embedding-optimizer';

/**
 * Configuration for embedding service
 */
export interface EmbeddingOptions {
  modelName?: string;
  maxSequenceLength?: number;
  batchSize?: number;
  cacheSize?: number;
  device?: 'cpu' | 'gpu';
  useOptimizer?: boolean; // Enable advanced memory optimization
}

/**
 * Embedding result with metadata (re-export from types)
 */
export type EmbeddingResult = BaseEmbeddingResult;

/**
 * Batch embedding request
 */
export interface BatchEmbeddingRequest {
  chunks: CodeChunk[];
  batchSize?: number;
}

/**
 * Embedding Service - Generates vector representations using local models
 */
export class EmbeddingService {
  private readonly options: Required<EmbeddingOptions>;
  private embeddingCache: Map<string, EmbeddingResult>;
  private model: any; // Transformers.js pipeline
  private isModelLoaded: boolean = false;
  private memoryManager: MemoryManager;
  private embeddingOptimizer: EmbeddingOptimizer | null = null;
  private useOptimizer: boolean = true; // Use optimizer by default for better memory management

  constructor(options: EmbeddingOptions = {}) {
    this.options = {
      modelName: options.modelName || 'Xenova/all-MiniLM-L6-v2',
      maxSequenceLength: options.maxSequenceLength || 512,
      batchSize: options.batchSize || 32,
      cacheSize: options.cacheSize || 10000,
      device: options.device || 'cpu',
      useOptimizer: options.useOptimizer !== false // Default true
    };

    this.embeddingCache = new Map();
    
    // Use centralized memory configuration
    const memoryConfig = MemoryConfigManager.getInstance().getConfig();
    this.memoryManager = new MemoryManager({
      maxHeapSizeMB: memoryConfig.thresholds.maxHeapSizeMB,
      gcThresholdMB: memoryConfig.thresholds.gcThresholdMB,
      batchSizeReductionThresholdMB: memoryConfig.thresholds.batchSizeReductionMB,
      emergencyThresholdMB: memoryConfig.thresholds.emergencyThresholdMB,
      enableForceGC: memoryConfig.garbageCollection.enabled,
      gcInterval: memoryConfig.garbageCollection.intervalMs
    });

    // Initialize embedding optimizer for advanced memory management
    if (this.options.useOptimizer) {
      try {
        this.embeddingOptimizer = new EmbeddingOptimizer({
          maxConcurrentOperations: 1, // Conservative for stability
          tensorCleanupIntervalMs: memoryConfig.delays.betweenEmbeddingsMs * 10, // 10x the delay
          modelRefreshInterval: 300000, // 5 minutes default
          enableResourcePooling: true,
          maxResourcePoolSize: 3, // Conservative pool size
          resourceTimeoutMs: memoryConfig.timeouts.batchTimeoutMs
        });
        console.log('[EmbeddingService] Embedding optimizer initialized for advanced memory management');
        this.useOptimizer = true;
      } catch (error) {
        console.warn('[EmbeddingService] Failed to initialize embedding optimizer, falling back to basic mode:', error);
        this.useOptimizer = false;
      }
    } else {
      this.useOptimizer = false;
    }
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    try {
      console.log(`[EmbeddingService] Initializing embedding service with model: ${this.options.modelName}`);
      
      if (this.useOptimizer && this.embeddingOptimizer) {
        // Use optimizer for better memory management
        await this.embeddingOptimizer.initialize();
        this.isModelLoaded = true;
        console.log('[EmbeddingService] Embedding optimizer ready');
      } else {
        // Fallback to direct model loading
        const { pipeline } = await import('@xenova/transformers');
        
        this.model = await pipeline(
          'feature-extraction',
          this.options.modelName
        );

        this.isModelLoaded = true;
        console.log('[EmbeddingService] Direct model loading complete');
      }
    } catch (error) {
      console.error('[EmbeddingService] Failed to initialize embedding service:', error);
      throw new Error(`Failed to initialize embedding service: ${error}`);
    }
  }

  /**
   * Generate embedding for a single code chunk
   */
  async generateEmbedding(chunk: CodeChunk): Promise<EmbeddingResult> {
    if (!this.isModelLoaded) {
      await this.initialize();
    }

    // Check cache first
    const cachedEmbedding = this.embeddingCache.get(chunk.id);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    try {
      let result: EmbeddingResult;

      if (this.useOptimizer && this.embeddingOptimizer) {
        // Use optimizer for better memory management
        result = await this.embeddingOptimizer.generateEmbedding(chunk);
      } else {
        // Fallback to direct model usage
        const text = this.prepareChunkText(chunk);
        
        const output = await this.model(text, {
          pooling: 'mean',
          normalize: true
        });

        const vector = Array.from(output.data as number[]);

        result = {
          chunkId: chunk.id,
          vector,
          dimension: vector.length,
          timestamp: Date.now(),
          model: this.options.modelName
        };
      }

      // Cache the result
      this.cacheEmbedding(result);
      return result;
    } catch (error) {
      console.error(`[EmbeddingService] Failed to generate embedding for chunk ${chunk.id}:`, error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple chunks in batches with memory management
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResult[]> {
    const { chunks } = request;

    // Use optimizer if available for better memory management
    if (this.useOptimizer && this.embeddingOptimizer) {
      console.log(`[EmbeddingService] Using EmbeddingOptimizer for batch processing of ${chunks.length} chunks`);
      const results = await this.embeddingOptimizer.generateBatchEmbeddings(chunks);
      
      // Cache results
      results.forEach(result => this.cacheEmbedding(result));
      
      return results;
    }

    // Fallback to manual batch processing with memory management
    return this.generateBatchEmbeddingsManual(request);
  }

  /**
   * Manual batch processing with memory management (fallback method)
   */
  private async generateBatchEmbeddingsManual(request: BatchEmbeddingRequest): Promise<EmbeddingResult[]> {
    const { chunks } = request;
    const results: EmbeddingResult[] = [];

    // Optimize batch size based on memory pressure
    const optimizedBatchSize = this.memoryManager.optimizeBatchSize(this.options.batchSize);
    
    console.log(`[EmbeddingService] Generating embeddings for ${chunks.length} chunks in batches of ${optimizedBatchSize}`);

    // Get initial memory stats
    const initialReport = this.memoryManager.getMemoryReport();
    console.log(`[Memory] Initial: ${initialReport.current.heapUsedMB}MB, Trend: ${initialReport.trend}`);

    for (let i = 0; i < chunks.length; i += optimizedBatchSize) {
      const batch = chunks.slice(i, i + optimizedBatchSize);
      const batchNumber = Math.floor(i / optimizedBatchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / optimizedBatchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}`);

      // Check memory pressure before processing batch
      const pressure = this.memoryManager.checkMemoryPressure();
      if (pressure.shouldPause) {
        console.log(`[Memory] Waiting for memory pressure reduction: ${pressure.severity}`);
        const reduced = await this.memoryManager.waitForMemoryPressureReduction(30000);
        if (!reduced) {
          console.warn('[Memory] Memory pressure reduction timed out, continuing with caution');
        }
      }

      if (pressure.shouldForceGC) {
        await this.memoryManager.forceGarbageCollection(`batch_${batchNumber}`);
      }

      // Process batch with controlled concurrency
      const batchResults: EmbeddingResult[] = [];
      for (const chunk of batch) {
        try {
          // Check memory before each embedding
          const currentPressure = this.memoryManager.checkMemoryPressure();
          if (currentPressure.shouldPause) {
            await this.memoryManager.waitForMemoryPressureReduction(5000);
          }

          const embedding = await this.generateEmbedding(chunk);
          batchResults.push(embedding);
          
          // Small delay to prevent memory spikes from Transformers.js
          if (batchResults.length % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
          continue; // Continue with other chunks instead of failing entire batch
        }
      }
      
      results.push(...batchResults);
      
      // Clear batch results to free memory immediately
      batchResults.length = 0;
      
      // Periodic GC every few batches
      if (batchNumber % 3 === 0) {
        await this.memoryManager.forceGarbageCollection(`periodic_batch_${batchNumber}`);
        // Brief pause to allow GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final memory report
    const finalReport = this.memoryManager.getMemoryReport();
    console.log(`[Memory] Final: ${finalReport.current.heapUsedMB}MB, GC calls: ${finalReport.gcStats.count}`);
    console.log(`[Memory] Memory increase: ${finalReport.current.heapUsedMB - initialReport.current.heapUsedMB}MB`);

    return results;
  }

  /**
   * Generate embedding for raw text (for search queries)
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    if (!this.isModelLoaded) {
      await this.initialize();
    }

    // Add defensive check for undefined or null text
    if (!text || typeof text !== 'string') {
      console.error(`[EmbeddingService] Invalid text parameter:`, text);
      throw new Error(`Text embedding generation failed: Invalid text parameter - expected string, got ${typeof text}: ${text}`);
    }

    try {
      if (this.useOptimizer && this.embeddingOptimizer) {
        // Use optimizer for text embedding
        const result = await this.embeddingOptimizer.generateEmbedding({
          id: 'text-embedding-' + Date.now(),
          type: 'function',
          name: 'text_embedding',
          content: text,
          filePath: 'text-query',
          language: 'text',
          startLine: 1,
          endLine: 1,
          startColumn: 1,
          endColumn: text.length,
          signature: undefined,
          documentation: undefined,
          dependencies: [],
          metadata: undefined,
          timestamp: Date.now()
        });
        return result.vector;
      } else {
        // Fallback to direct model usage
        const output = await this.model(text, {
          pooling: 'mean',
          normalize: true
        });

        // Convert to array and flatten
        return Array.from(output.data as number[]);
      }
    } catch (error) {
      console.error(`[EmbeddingService] Failed to generate embedding for text:`, error);
      throw new Error(`Text embedding generation failed: ${error}`);
    }
  }

  /**
   * Prepare chunk text for embedding
   */
  private prepareChunkText(chunk: CodeChunk): string {
    // Combine relevant information for embedding
    const parts: string[] = [];

    // Add chunk type and content
    parts.push(`${chunk.type}: ${chunk.content.substring(0, 200)}`);

    // Add language
    parts.push(`Language: ${chunk.language}`);

    // Add file path for context
    parts.push(`File: ${chunk.filePath}`);

    return parts.join('\n');
  }

  /**
   * Cache embedding result
   */
  private cacheEmbedding(result: EmbeddingResult): void {
    // Enforce cache size limit
    if (this.embeddingCache.size >= this.options.cacheSize) {
      // Remove oldest entries (simple FIFO)
      const oldestKey = this.embeddingCache.keys().next().value;
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }

    this.embeddingCache.set(result.chunkId, result);
  }

  /**
   * Get cached embedding
   */
  getCachedEmbedding(chunkId: string): EmbeddingResult | null {
    return this.embeddingCache.get(chunkId) || null;
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Get embedding cache statistics
   */
  getCacheStats(): {
    cacheSize: number;
    maxCacheSize: number;
    hitRate: number;
    modelName: string;
  } {
    return {
      cacheSize: this.embeddingCache.size,
      maxCacheSize: this.options.cacheSize,
      hitRate: 0, // Could be implemented with access tracking
      modelName: this.options.modelName
    };
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar embeddings
   */
  async findMostSimilar(
    queryEmbedding: EmbeddingResult,
    candidateEmbeddings: EmbeddingResult[],
    topK: number = 5
  ): Promise<Array<{ embedding: EmbeddingResult; similarity: number }>> {
    const similarities = candidateEmbeddings.map(embedding => ({
      embedding,
      similarity: this.calculateSimilarity(queryEmbedding.vector, embedding.vector)
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    return similarities.slice(0, topK);
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    name: string;
    dimension: number | null;
    maxSequenceLength: number;
    device: string;
  } {
    return {
      name: this.options.modelName,
      dimension: this.isModelLoaded ? 384 : null, // all-MiniLM-L6-v2 outputs 384 dimensions
      maxSequenceLength: this.options.maxSequenceLength,
      device: this.options.device
    };
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    return 384; // all-MiniLM-L6-v2 outputs 384 dimensions
  }
}

// Factory function for backward compatibility with tests
export function createEmbeddingService(options?: EmbeddingOptions): EmbeddingService {
  return new EmbeddingService(options);
}