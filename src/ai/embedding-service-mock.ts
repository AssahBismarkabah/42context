import { CodeChunk, EmbeddingResult } from '../core/types';
import { EmbeddingOptions } from './embedding-service';

/**
 * Mock Embedding Service for testing and fallback scenarios
 */
export class MockEmbeddingService {
  private readonly options: Required<EmbeddingOptions>;

  constructor(options: EmbeddingOptions = {}) {
    this.options = {
      modelName: options.modelName || 'mock-model',
      maxSequenceLength: options.maxSequenceLength || 512,
      batchSize: options.batchSize || 32,
      cacheSize: options.cacheSize || 10000,
      device: options.device || 'cpu',
      useOptimizer: options.useOptimizer !== false
    };
  }

  async initialize(): Promise<void> {
    console.log('[MockEmbeddingService] Initializing mock embedding service');
    // Simulate async initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[MockEmbeddingService] Mock embedding service initialized');
  }

  async generateEmbedding(chunk: CodeChunk): Promise<EmbeddingResult> {
    // Simulate embedding generation
    await new Promise(resolve => setTimeout(resolve, 10));
    const mockVector = Array.from({ length: 384 }, () => Math.random()); // 384-dimension mock vector
    return {
      chunkId: chunk.id,
      vector: mockVector,
      dimension: mockVector.length,
      timestamp: Date.now(),
      model: this.options.modelName
    };
  }

  async generateTextEmbedding(_text: string): Promise<number[]> {
    // Simulate text embedding generation
    await new Promise(resolve => setTimeout(resolve, 10));
    return Array.from({ length: 384 }, () => Math.random()); // 384-dimension mock vector
  }
}