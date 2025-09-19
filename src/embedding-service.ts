/**
 * Embedding Service for generating vector representations of code chunks
 * Uses local models for privacy-first semantic search
 */

import { CodeChunk } from './types';

/**
 * Configuration for embedding service
 */
export interface EmbeddingOptions {
  modelName?: string;
  maxSequenceLength?: number;
  batchSize?: number;
  cacheSize?: number;
  device?: 'cpu' | 'gpu';
}

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  chunkId: string;
  vector: number[];
  dimension: number;
  timestamp: number;
  model: string;
}

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

  constructor(options: EmbeddingOptions = {}) {
    this.options = {
      modelName: options.modelName || 'Xenova/all-MiniLM-L6-v2',
      maxSequenceLength: options.maxSequenceLength || 512,
      batchSize: options.batchSize || 32,
      cacheSize: options.cacheSize || 10000,
      device: options.device || 'cpu'
    };

    this.embeddingCache = new Map();
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Loading embedding model: ${this.options.modelName}`);
      
      // Dynamic import for Transformers.js
      const { pipeline } = await import('@xenova/transformers');
      
      this.model = await pipeline(
        'feature-extraction',
        this.options.modelName
      );

      this.isModelLoaded = true;
      console.log(' Embedding model loaded successfully');
    } catch (error) {
      console.error(' Failed to load embedding model:', error);
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
      // Prepare text for embedding
      const text = this.prepareChunkText(chunk);
      
      // Generate embedding
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to array and flatten
      const vector = Array.from(output.data as number[]);

      const result: EmbeddingResult = {
        chunkId: chunk.id,
        vector,
        dimension: vector.length,
        timestamp: Date.now(),
        model: this.options.modelName
      };

      // Cache the result
      this.cacheEmbedding(result);

      return result;
    } catch (error) {
      console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple chunks in batches
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResult[]> {
    const { chunks, batchSize = this.options.batchSize } = request;
    const results: EmbeddingResult[] = [];

    console.log(`Generating embeddings for ${chunks.length} chunks in batches of ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

      const batchPromises = batch.map(chunk => this.generateEmbedding(chunk));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate embedding for raw text (for search queries)
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    if (!this.isModelLoaded) {
      await this.initialize();
    }

    try {
      // Generate embedding
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to array and flatten
      return Array.from(output.data as number[]);
    } catch (error) {
      console.error(`Failed to generate embedding for text:`, error);
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