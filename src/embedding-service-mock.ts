/**
 * Mock Embedding Service for testing when Transformers.js is not available
 * Generates random vectors for testing purposes
 */

import { CodeChunk } from './types';

export interface EmbeddingOptions {
  modelName?: string;
  maxSequenceLength?: number;
  batchSize?: number;
  cacheSize?: number;
  device?: 'cpu' | 'gpu';
}

export interface EmbeddingResult {
  chunkId: string;
  vector: number[];
  dimension: number;
  timestamp: number;
  model: string;
}

export interface BatchEmbeddingRequest {
  chunks: CodeChunk[];
  batchSize?: number;
}

export class MockEmbeddingService {
  private readonly options: Required<EmbeddingOptions>;
  private embeddingCache: Map<string, EmbeddingResult>;
  private isModelLoaded: boolean = false;

  constructor(options: EmbeddingOptions = {}) {
    this.options = {
      modelName: options.modelName || 'Mock/all-MiniLM-L6-v2',
      maxSequenceLength: options.maxSequenceLength || 512,
      batchSize: options.batchSize || 32,
      cacheSize: options.cacheSize || 10000,
      device: options.device || 'cpu'
    };

    this.embeddingCache = new Map();
  }

  async initialize(): Promise<void> {
    console.log(`Loading mock embedding model: ${this.options.modelName}`);
    this.isModelLoaded = true;
    console.log(' Mock embedding model loaded successfully');
  }

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
      // Generate mock embedding (384 dimensions like all-MiniLM-L6-v2)
      const vector = this.generateMockVector(384);
      
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

  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResult[]> {
    const { chunks, batchSize = this.options.batchSize } = request;
    const results: EmbeddingResult[] = [];

    console.log(`Generating mock embeddings for ${chunks.length} chunks in batches of ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

      const batchPromises = batch.map(chunk => this.generateEmbedding(chunk));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async generateTextEmbedding(text: string): Promise<number[]> {
    if (!this.isModelLoaded) {
      await this.initialize();
    }

    try {
      // Generate mock embedding for text (use text for seed to make it deterministic)
      const seed = this.hashCode(text);
      return this.generateMockVectorWithSeed(384, seed);
    } catch (error) {
      console.error(`Failed to generate embedding for text:`, error);
      throw new Error(`Text embedding generation failed: ${error}`);
    }
  }

  private generateMockVector(dimension: number): number[] {
    return this.generateMockVectorWithSeed(dimension, this.hashCode('mock-seed'));
  }

  private generateMockVectorWithSeed(dimension: number, seed: number): number[] {
    // Generate a deterministic vector based on seed for consistency
    const vector: number[] = [];
    
    for (let i = 0; i < dimension; i++) {
      // Use a simple pseudo-random generator for reproducible results
      vector.push((Math.sin(seed + i) * 0.5 + 0.5) * 0.1);
    }
    
    return vector;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

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

  getCachedEmbedding(chunkId: string): EmbeddingResult | null {
    return this.embeddingCache.get(chunkId) || null;
  }

  clearCache(): void {
    this.embeddingCache.clear();
  }

  getCacheStats(): {
    cacheSize: number;
    maxCacheSize: number;
    hitRate: number;
    modelName: string;
  } {
    return {
      cacheSize: this.embeddingCache.size,
      maxCacheSize: this.options.cacheSize,
      hitRate: 0,
      modelName: this.options.modelName
    };
  }

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

  isReady(): boolean {
    return this.isModelLoaded;
  }

  getModelInfo(): {
    name: string;
    dimension: number | null;
    maxSequenceLength: number;
    device: string;
  } {
    return {
      name: this.options.modelName,
      dimension: this.isModelLoaded ? 384 : null,
      maxSequenceLength: this.options.maxSequenceLength,
      device: this.options.device
    };
  }

  getEmbeddingDimension(): number {
    return 384;
  }
}

// Factory function for backward compatibility
export function createEmbeddingService(options?: EmbeddingOptions): MockEmbeddingService {
  return new MockEmbeddingService(options);
}