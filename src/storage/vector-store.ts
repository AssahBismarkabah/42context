
/**
 * Vector Store Service for semantic code search using ChromaDB
 * Provides embedding-based similarity search for code chunks
 */

// Dynamic import for ChromaDB to handle CommonJS compatibility
let ChromaClient: any;

/**
 * Configuration for vector store
 */
export interface VectorStoreConfig {
  collectionName?: string;
  persistDirectory?: string;
  embeddingModel?: string;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
  chunk: any; // CodeChunk interface will be imported from code-storage
  score: number;
  metadata: Record<string, any>;
}

/**
 * Code chunk interface (minimal version for vector store)
 */
interface CodeChunk {
  id: string;
  type: string;
  name: string;
  content: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  signature?: string;
  documentation?: string;
  dependencies: string[];
  timestamp: number;
}

/**
 * Vector Store Service using ChromaDB
 */
export class VectorStore {
  private client: any;
  private collection: any = null;
  private readonly config: Required<VectorStoreConfig>;
  private isInitialized: boolean = false;

  constructor(config: VectorStoreConfig = {}) {
    this.config = {
      collectionName: config.collectionName || 'code_chunks',
      persistDirectory: config.persistDirectory || './.vector-store',
      embeddingModel: config.embeddingModel || 'all-MiniLM-L6-v2',
      distanceMetric: config.distanceMetric || 'cosine'
    };
  }

  /**
   * Initialize the vector store and create collection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamic import for ChromaDB
      const chromadb = await import('chromadb');
      ChromaClient = chromadb.ChromaClient;

      // Create persist directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync(this.config.persistDirectory)) {
        fs.mkdirSync(this.config.persistDirectory, { recursive: true });
      }

      // Initialize ChromaDB client with local persistence
      this.client = new ChromaClient({
        path: this.config.persistDirectory
      });

      // Create or get collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        metadata: {
          'hnsw:space': this.config.distanceMetric,
          'hnsw:construction_ef': 100,
          'hnsw:M': 16
        }
      });

      this.isInitialized = true;
      console.log(`Vector store initialized with collection: ${this.config.collectionName}`);
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw new Error(`Vector store initialization failed: ${error}`);
    }
  }

  /**
   * Convert code chunk to searchable text
   */
  private chunkToText(chunk: CodeChunk): string {
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
   * Add code chunks to vector store with embeddings
   */
  async addChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      // Dynamic import for embedding service
      const { generateEmbedding } = await import('../core/embedding-service.js');

      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => this.chunkToText(chunk));
      const embeddings = await generateEmbedding(texts);

      // Prepare data for ChromaDB
      const ids = chunks.map(chunk => chunk.id);
      const metadatas = chunks.map(chunk => ({
        filePath: chunk.filePath,
        language: chunk.language,
        type: chunk.type,
        name: chunk.name,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        signature: chunk.signature,
        documentation: chunk.documentation,
        dependencies: chunk.dependencies,
        timestamp: chunk.timestamp
      }));

      // Add to collection
      await this.collection.add({
        ids,
        embeddings,
        documents: texts,
        metadatas
      });

      console.log(`Added ${chunks.length} chunks to vector store`);
    } catch (error) {
      console.error('Failed to add chunks to vector store:', error);
      throw new Error(`Failed to add chunks: ${error}`);
    }
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

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      // Dynamic import for embedding service
      const { generateEmbedding } = await import('../core/embedding-service.js');

      // Generate embedding for query
      const queryEmbedding = await generateEmbedding([query]);

      // Build where clause for filtering
      const where: Record<string, any> = {};
      if (options.language) where.language = options.language;
      if (options.type) where.type = options.type;
      if (options.filePath) where.filePath = options.filePath;

      // Perform similarity search
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding[0], // Use first embedding from array
        nResults: options.topK || 5,
        where: Object.keys(where).length > 0 ? where : undefined,
        include: ['documents', 'metadatas', 'distances']
      });

      // Format results
      const searchResults: VectorSearchResult[] = [];
      
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const metadata = results.metadatas?.[0]?.[i];
          const distance = results.distances?.[0]?.[i];
          
          if (metadata && distance !== undefined) {
            // Convert distance to similarity score (0-1)
            const score = 1 - distance;
            
            // Skip results below threshold
            if (options.threshold && score < options.threshold) {
              continue;
            }

            // Reconstruct CodeChunk from metadata
            const chunk: CodeChunk = {
              id: id as string,
              type: metadata.type,
              name: metadata.name,
              content: results.documents?.[0]?.[i] || '',
              filePath: metadata.filePath,
              language: metadata.language,
              startLine: metadata.startLine,
              endLine: metadata.endLine,
              signature: metadata.signature,
              documentation: metadata.documentation,
              dependencies: metadata.dependencies || [],
              timestamp: metadata.timestamp
            };

            searchResults.push({
              chunk,
              score,
              metadata: metadata
            });
          }
        }
      }

      console.log(`Vector search completed, found ${searchResults.length} results`);
      return searchResults;
    } catch (error) {
      console.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  /**
   * Update existing chunks in vector store
   */
  async updateChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      // Dynamic import for embedding service
      const { generateEmbedding } = await import('../core/embedding-service.js');

      // Generate new embeddings
      const texts = chunks.map(chunk => this.chunkToText(chunk));
      const embeddings = await generateEmbedding(texts);

      // Prepare update data
      const ids = chunks.map(chunk => chunk.id);
      const metadatas = chunks.map(chunk => ({
        filePath: chunk.filePath,
        language: chunk.language,
        type: chunk.type,
        name: chunk.name,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        signature: chunk.signature,
        documentation: chunk.documentation,
        dependencies: chunk.dependencies,
        timestamp: chunk.timestamp
      }));

      // Update in collection
      await this.collection.update({
        ids,
        embeddings,
        documents: texts,
        metadatas
      });

      console.log(`Updated ${chunks.length} chunks in vector store`);
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

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      await this.collection.delete({
        ids: chunkIds
      });

      console.log(`Removed ${chunkIds.length} chunks from vector store`);
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

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      await this.collection.delete({
        where: { filePath: filePath }
      });

      console.log(`Removed all chunks for file: ${filePath}`);
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

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      const count = await this.collection.count();
      
      return {
        collectionName: this.config.collectionName,
        chunkCount: count,
        persistDirectory: this.config.persistDirectory,
        isInitialized: this.isInitialized
      };
    } catch (error) {
      console.error('Failed to get vector store stats:', error);
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

    if (!this.collection) {
      throw new Error('Vector store not properly initialized');
    }

    try {
      // Delete all documents in collection
      await this.collection.delete({});
      console.log('Vector store cleared');
    } catch (error) {
      console.error('Failed to clear vector store:', error);
      throw new Error(`Failed to clear vector store: ${error}`);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.collection = null;
    this.client = null;
    this.isInitialized = false;
  }
}

/**
 * Global vector store instance
 */
let globalVectorStore: VectorStore | null = null;

/**
 * Get or create global vector store
 */
export function getVectorStore(config?: VectorStoreConfig): VectorStore {
  if (!globalVectorStore) {
    globalVectorStore = new VectorStore(config);
  }
  return globalVectorStore;
}
