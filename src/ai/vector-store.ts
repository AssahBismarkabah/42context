
/**
 * Vector Store Service for persistent storage and similarity search of embeddings
 * Uses ChromaDB for local vector database operations
 */

import { ChromaClient, Collection, IncludeEnum, IEmbeddingFunction } from 'chromadb';
import { EmbeddingResult } from './embedding-service';
import { CodeChunk } from '../storage/code-storage';

/**
 * Simple embedding function for ChromaDB compatibility
 */
class SimpleEmbeddingFunction implements IEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    // Return dummy embeddings - we'll handle real embeddings manually
    return texts.map(() => new Array(384).fill(0));
  }
}

/**
 * Vector store configuration
 */
interface VectorStoreOptions {
  collectionName?: string;
  persistDirectory?: string;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
  embeddingDimension?: number;
}

/**
 * Vector search result
 */
interface VectorSearchResult {
  chunkId: string;
  similarity: number;
  metadata: {
    chunk: CodeChunk;
    embedding: EmbeddingResult;
  };
}

/**
 * Vector Store Service - Manages persistent vector storage and similarity search
 */
class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private readonly options: Required<VectorStoreOptions>;
  private isInitialized: boolean = false;

  constructor(options: VectorStoreOptions = {}) {
    this.options = {
      collectionName: options.collectionName || 'code_embeddings',
      persistDirectory: options.persistDirectory || './.chroma_db',
      distanceMetric: options.distanceMetric || 'cosine',
      embeddingDimension: options.embeddingDimension || 384
    };

    // Initialize ChromaDB client
    this.client = new ChromaClient({
      path: this.options.persistDirectory
    });
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Initializing vector store: ${this.options.collectionName}`);
      
      // Check if collection exists
      const collections = await this.client.listCollections();
      const collectionExists = collections.some((col: any) => col.name === this.options.collectionName);
      
      if (collectionExists) {
        // Get existing collection
        this.collection = await this.client.getCollection({
          name: this.options.collectionName,
          embeddingFunction: new SimpleEmbeddingFunction()
        });
        console.log(`Using existing collection: ${this.options.collectionName}`);
      } else {
        // Create new collection
        this.collection = await this.client.createCollection({
          name: this.options.collectionName,
          embeddingFunction: new SimpleEmbeddingFunction(),
          metadata: {
            'hnsw:space': this.options.distanceMetric,
            dimension: this.options.embeddingDimension
          }
        });
        console.log(`Created new collection: ${this.options.collectionName}`);
      }

      this.isInitialized = true;
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw new Error(`Vector store initialization failed: ${error}`);
    }
  }

  /**
   * Store embedding in vector database
   */
  async storeEmbedding(embedding: EmbeddingResult, chunk: CodeChunk): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Prepare metadata
      const metadata = {
        chunkId: chunk.id,
        chunkType: chunk.type,
        chunkName: chunk.name,
        filePath: chunk.filePath,
        language: chunk.language,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        timestamp: chunk.timestamp,
        embeddingTimestamp: embedding.timestamp,
        model: embedding.model
      };

      // Store in ChromaDB
      await this.collection.add({
        ids: [embedding.chunkId],
        embeddings: [embedding.vector],
        metadatas: [metadata],
        documents: [chunk.content.substring(0, 1000)] // Truncate content for storage
      });

      console.log(`Stored embedding for chunk: ${chunk.name} (${chunk.id})`);
    } catch (error) {
      console.error(`Failed to store embedding for chunk ${chunk.id}:`, error);
      throw new Error(`Embedding storage failed: ${error}`);
    }
  }

  /**
   * Store multiple embeddings in batch
   */
  async storeEmbeddings(embeddings: EmbeddingResult[], chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    if (embeddings.length !== chunks.length) {
      throw new Error('Embeddings and chunks arrays must have the same length');
    }

    try {
      const ids: string[] = [];
      const vectors: number[][] = [];
      const metadatas: any[] = [];
      const documents: string[] = [];

      for (let i = 0; i < embeddings.length; i++) {
        const embedding = embeddings[i];
        const chunk = chunks[i];

        ids.push(embedding.chunkId);
        vectors.push(embedding.vector);
        
        metadatas.push({
          chunkId: chunk.id,
          chunkType: chunk.type,
          chunkName: chunk.name,
          filePath: chunk.filePath,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          timestamp: chunk.timestamp,
          embeddingTimestamp: embedding.timestamp,
          model: embedding.model
        });

        documents.push(chunk.content.substring(0, 1000));
      }

      // Store in ChromaDB
      await this.collection.add({
        ids,
        embeddings: vectors,
        metadatas,
        documents
      });

      console.log(`Stored ${embeddings.length} embeddings in vector store`);
    } catch (error) {
      console.error('Failed to store embeddings batch:', error);
      throw new Error(`Batch embedding storage failed: ${error}`);
    }
  }

  /**
   * Search for similar embeddings
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: {
      language?: string;
      filePath?: string;
      chunkType?: string;
    }
  ): Promise<VectorSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Build query filter
      const where: any = {};
      if (filter?.language) where.language = filter.language;
      if (filter?.filePath) where.filePath = filter.filePath;
      if (filter?.chunkType) where.chunkType = filter.chunkType;

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined,
        include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances]
      });

      // Convert to our format
      const searchResults: VectorSearchResult[] = [];
      
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const chunkId = results.ids[0][i];
          const distance = results.distances?.[0]?.[i] || 0;
          const metadata = results.metadatas?.[0]?.[i];
          const document = results.documents?.[0]?.[i];

          if (!metadata) continue;

          // Convert distance to similarity (for cosine distance)
          const similarity = 1 - distance;

          // Safely extract metadata with type checking
          const chunkIdStr = String(metadata.chunkId || chunkId);
          const chunkType = String(metadata.chunkType) as CodeChunk['type'];
          const chunkName = String(metadata.chunkName);
          const filePath = String(metadata.filePath);
          const language = String(metadata.language);
          const startLine = Number(metadata.startLine);
          const endLine = Number(metadata.endLine);
          const timestamp = Number(metadata.timestamp);
          const embeddingTimestamp = Number(metadata.embeddingTimestamp);
          const model = String(metadata.model);

          searchResults.push({
            chunkId: chunkIdStr,
            similarity,
            metadata: {
              chunk: {
                id: chunkIdStr,
                type: chunkType,
                name: chunkName,
                content: document || '',
                filePath: filePath,
                language: language,
                startLine: startLine,
                endLine: endLine,
                startColumn: 0,
                endColumn: 0,
                signature: undefined,
                documentation: undefined,
                dependencies: [],
                metadata: undefined,
                timestamp: timestamp
              },
              embedding: {
                chunkId: chunkIdStr,
                vector: [], // Vector not returned by default in query
                dimension: this.options.embeddingDimension,
                timestamp: embeddingTimestamp,
                model: model
              }
            }
          });
        }
      }

      console.log(`Found ${searchResults.length} similar vectors`);
      return searchResults;
    } catch (error) {
      console.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  /**
   * Search by text query (generate embedding and search)
   */
  async searchByText(
    queryText: string,
    embeddingService: any, // EmbeddingService
    topK: number = 5,
    filter?: {
      language?: string;
      filePath?: string;
      chunkType?: string;
    }
  ): Promise<VectorSearchResult[]> {
    // Generate embedding for the query text
    const queryEmbedding = await embeddingService.generateEmbedding({
      id: 'query',
      type: 'query',
      name: 'query',
      content: queryText,
      filePath: '',
      language: 'text',
      startLine: 0,
      endLine: 0,
      startColumn: 0,
      endColumn: 0,
      signature: undefined,
      documentation: undefined,
      dependencies: [],
      metadata: undefined,
      timestamp: Date.now()
    });

    return this.searchSimilar(queryEmbedding.vector, topK, filter);
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; dimension: number }> {
    if (!this.isInitialized || !this.collection) {
      return { count: 0, dimension: this.options.embeddingDimension };
    }

    try {
      const count = await this.collection.count();
      return {
        count,
        dimension: this.options.embeddingDimension
      };
    } catch (error) {
      console.error('Failed to get vector store stats:', error);
      return { count: 0, dimension: this.options.embeddingDimension };
    }
  }

  /**
   * Clear all vectors from the collection
   */
  async clear(): Promise<void> {
    if (!this.isInitialized || !this.collection) {
      return;
    }

    try {
      // Delete and recreate collection
      await this.client.deleteCollection({ name: this.options.collectionName });
      this.collection = await this.client.createCollection({
        name: this.options.collectionName,
        embeddingFunction: new SimpleEmbeddingFunction(),
        metadata: {
          'hnsw:space': this.options.distanceMetric,
          dimension: this.options.embeddingDimension
        }
      });
      console.log('Vector store cleared successfully');
    } catch (error) {
      console.error('Failed to clear vector store:', error);
      throw new Error(`Vector store clear failed: ${error}`);
    }
  }

  /**
   * Check if vector store is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.collection !== null;
  }

  /**
   * Get vector store configuration
   */
  getConfig(): VectorStoreOptions {
    return { ...this.options };
  }
}

/**
 * Factory function to create vector store
 */
function createVectorStore(options: VectorStoreOptions = {}): VectorStore {
  return new VectorStore(options);
}

/**
 * ES Module exports
 */
export { VectorStore, createVectorStore };
export type { VectorStoreOptions, VectorSearchResult };
