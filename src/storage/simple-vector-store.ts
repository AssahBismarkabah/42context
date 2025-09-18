
/**
 * Simple Vector Store Implementation
 * Provides basic semantic search functionality without external dependencies
 * This is a temporary implementation until ChromaDB integration is fully working
 */

import { generateEmbedding } from '../core/embedding-service.js';

/**
 * Configuration for simple vector store
 */
export interface SimpleVectorStoreConfig {
  collectionName?: string;
  persistDirectory?: string;
  embeddingModel?: string;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
  chunk: any; // CodeChunk interface
  score: number;
  metadata: Record<string, any>;
}

/**
 * Simple Vector Store using in-memory storage
 */
export class SimpleVectorStore {
  private readonly config: Required<SimpleVectorStoreConfig>;
  private isInitialized: boolean = false;
  private vectors: Array<{
    id: string;
    embedding: number[];
    chunk: any;
    metadata: Record<string, any>;
  }> = [];

  constructor(config: SimpleVectorStoreConfig = {}) {
    this.config = {
      collectionName: config.collectionName || 'code_chunks',
      persistDirectory: config.persistDirectory || './.vector-store',
      embeddingModel: config.embeddingModel || 'all-MiniLM-L6-v2',
      distanceMetric: config.distanceMetric || 'cosine'
    };
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create persist directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync(this.config.persistDirectory)) {
        fs.mkdirSync(this.config.persistDirectory, { recursive: true });
      }

      this.isInitialized = true;
      console.log(`Simple vector store initialized: ${this.config.collectionName}`);
    } catch (error) {
      console.error('Failed to initialize simple vector store:', error);
      throw new Error(`Simple vector store initialization failed: ${error}`);
    }
  }

  /**
   * Add code chunks to vector store with embeddings
   */
  async addChunks(chunks: any[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => this.chunkToText(chunk));
      const embeddings = await generateEmbedding(texts);

      // Store vectors in memory
      for (let i = 0; i < chunks.length; i++) {
        this.vectors.push({
          id: chunks[i].id,
          embedding: embeddings[i],
          chunk: chunks[i],
          metadata: {
            filePath: chunks[i].filePath,
            language: chunks[i].language,
            type: chunks[i].type,
            name: chunks[i].name,
            startLine: chunks[i].startLine,
            endLine: chunks[i].endLine,
            signature: chunks[i].signature,
            documentation: chunks[i].documentation,
            dependencies: chunks[i].dependencies,
            timestamp: chunks[i].timestamp
          }
        });
      }

      console.log(`Added ${chunks.length} chunks to simple vector store`);
    } catch (error) {
      console.error('Failed to add chunks to simple vector store:', error);
      throw new Error(`Failed to add chunks: ${error}`);
    }
  }

  /**
   * Convert code chunk to searchable text
   */
  private chunkToText(chunk: any): string {
    let text = `${chunk.type} ${chunk.name}\n`;
    if (chunk.signature) {
      text += `${chunk.signature}\n`;
    }
    if (chunk.documentation) {
      text += `${chunk.documentation}\n`;
    }
    text += chunk.content;
    return text;
  }

  /**
   * Search for similar code chunks using semantic similarity
   */
  async searchSimilar(
    query: string,
    options: {
      topK?: number;
      language?: string;
      type?: string;
      filePath?: string;
      threshold?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await generateEmbedding([query]);
      const queryVector = queryEmbedding[0];

      // Calculate similarities
      const similarities = this.vectors.map(vector => {
        // Apply filters if specified
        if (options.language && vector.chunk.language !== options.language) {
          return null;
        }
        if (options.type && vector.chunk.type !== options.type) {
          return null;
        }
        if (options.filePath && vector.chunk.filePath !== options.filePath) {
          return null;
        }

        // Calculate cosine similarity
        const similarity = this.calculateCosineSimilarity(queryVector, vector.embedding);
        
        return {
          chunk: vector.chunk,
          score: similarity,
          metadata: vector.metadata
        };
      }).filter(result => result !== null) as VectorSearchResult[];

      // Sort by similarity and apply threshold
      similarities.sort((a, b) => b.score - a.score);
      
      let results = similarities;
      if (options.threshold) {
        results = results.filter(result => result.score >= (options.threshold || 0));
      }
      
      // Limit results
      const finalResults = results.slice(0, options.topK || 5);

      console.log(`Simple vector search completed, found ${finalResults.length} results`);
      return finalResults;
    } catch (error) {
      console.error('Simple vector search failed:', error);
      throw new Error(`Simple vector search failed: ${error}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Update existing chunks in vector store
   */
  async updateChunks(chunks: any[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Remove old vectors
      const idsToRemove = chunks.map(chunk => chunk.id);
      this.vectors = this.vectors.filter(vector => !idsToRemove.includes(vector.id));

      // Add new vectors
      await this.addChunks(chunks);
    } catch (error) {
      console.error('Failed to update chunks:', error);
      throw new Error(`Failed to update chunks: ${error}`);
    }
  }

  /**
   * Remove chunks from vector store
   */
  async removeChunks(chunkIds: string[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.vectors = this.vectors.filter(vector => !chunkIds.includes(vector.id));
      console.log(`Removed ${chunkIds.length} chunks from simple vector store`);
    } catch (error) {
      console.error('Failed to remove chunks:', error);
      throw new Error(`Failed to remove chunks: ${error}`);
    }
  }

  /**
   * Remove all chunks for a specific file
   */
  async removeChunksByFile(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const initialCount = this.vectors.length;
      this.vectors = this.vectors.filter(vector => vector.chunk.filePath !== filePath);
      const removedCount = initialCount - this.vectors.length;
      
      console.log(`Removed ${removedCount} chunks for file: ${filePath}`);
    } catch (error) {
      console.error('Failed to remove chunks by file:', error);
      throw new Error(`Failed to remove chunks by file: ${error}`);
    }
  }

  /**
   * Get vector store statistics
   */
  async getStats(): Promise<{
    collectionName: string;
    chunkCount: number;
    persistDirectory: string;
    isInitialized: boolean;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return {
        collectionName: this.config.collectionName,
        chunkCount: this.vectors.length,
        persistDirectory: this.config.persistDirectory,
        isInitialized: this.isInitialized
      };
    } catch (error) {
      console.error('Failed to get simple vector store stats:', error);
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  /**
   * Clear all data from vector store
   */
  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.vectors = [];
      console.log('Simple vector store cleared');
    } catch (error) {
      console.error('Failed to clear simple vector store:', error);
      throw new Error(`Failed to clear simple vector store: ${error}`);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.vectors = [];
    this.isInitialized = false;
  }
}

/**
 * Global simple vector store instance
 */
let globalSimpleVectorStore: SimpleVectorStore | null = null;

/**
 * Get or create global simple vector store
 */
export function getSimpleVectorStore(config?: SimpleVectorStoreConfig): SimpleVectorStore {
  if (!globalSimpleVectorStore) {
    globalSimpleVectorStore = new SimpleVectorStore(config);
  }
  return globalSimpleVectorStore;
}