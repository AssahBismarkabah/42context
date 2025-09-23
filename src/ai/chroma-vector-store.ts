import { ChromaClient, Collection } from 'chromadb';
import { VectorStore, VectorSearchResult, CodeVector } from '../core/types';

export class ChromaVectorStore implements VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string;
  private host: string;
  private port: number;
  private authToken: string;

  constructor(collectionName: string = 'code_vectors', host: string = 'localhost', port: number = 8000, authToken: string = 'test-token') {
    this.collectionName = collectionName;
    this.host = host;
    this.port = port;
    this.authToken = authToken;
    
    // Initialize ChromaDB client with proper authentication
    this.client = new ChromaClient({
      path: `http://${this.host}:${this.port}`,
      auth: {
        provider: 'token',
        credentials: this.authToken
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      // Create or get collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 'hnsw:space': 'cosine' } // Use cosine similarity for code vectors
      });
      console.log(`ChromaDB collection '${this.collectionName}' initialized successfully`);
    } catch (error) {
      console.error('Failed to initialize ChromaDB collection:', error);
      throw error;
    }
  }

  async addVectors(vectors: CodeVector[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    if (vectors.length === 0) return;

    try {
      // Prepare data for ChromaDB
      const ids = vectors.map(v => v.id);
      const embeddings = vectors.map(v => v.embedding);
      const documents = vectors.map(v => v.content);
      const metadatas = vectors.map(v => ({
        filePath: v.filePath,
        language: v.language,
        type: v.type,
        lineStart: v.lineStart,
        lineEnd: v.lineEnd,
        timestamp: v.timestamp
      }));

      // Add vectors to collection
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      console.log(`Added ${vectors.length} vectors to ChromaDB collection`);
    } catch (error) {
      console.error('Failed to add vectors to ChromaDB:', error);
      throw error;
    }
  }

  async searchSimilar(queryVector: number[], topK: number = 5, language?: string): Promise<VectorSearchResult[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    try {
      // Build query parameters
      const queryParams: any = {
        queryEmbeddings: [queryVector],
        nResults: topK
      };

      // Add language filter if specified
      if (language) {
        queryParams.where = { language: language };
      }

      // Perform similarity search
      const results = await this.collection.query(queryParams);

      // Transform results to our format
      const searchResults: VectorSearchResult[] = [];
      
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const document = results.documents?.[0]?.[i] || '';
          const metadata = results.metadatas?.[0]?.[i] as any;
          const distance = results.distances?.[0]?.[i] || 0;
          
          searchResults.push({
            id,
            content: document,
            filePath: metadata?.filePath || '',
            language: metadata?.language || '',
            type: metadata?.type || '',
            lineStart: metadata?.lineStart || 0,
            lineEnd: metadata?.lineEnd || 0,
            similarity: 1 - distance, // Convert distance to similarity score
            timestamp: metadata?.timestamp || Date.now()
          });
        }
      }

      return searchResults;
    } catch (error) {
      console.error('Failed to search ChromaDB:', error);
      throw error;
    }
  }

  async deleteVectors(filePath: string): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    try {
      // Delete all vectors for a specific file path
      await this.collection.delete({
        where: { filePath: filePath }
      });
      
      console.log(`Deleted vectors for file: ${filePath}`);
    } catch (error) {
      console.error('Failed to delete vectors from ChromaDB:', error);
      throw error;
    }
  }

  async updateVectors(vectors: CodeVector[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    if (vectors.length === 0) return;

    try {
      // Prepare data for update
      const ids = vectors.map(v => v.id);
      const embeddings = vectors.map(v => v.embedding);
      const documents = vectors.map(v => v.content);
      const metadatas = vectors.map(v => ({
        filePath: v.filePath,
        language: v.language,
        type: v.type,
        lineStart: v.lineStart,
        lineEnd: v.lineEnd,
        timestamp: v.timestamp
      }));

      // Update vectors in collection
      await this.collection.update({
        ids,
        embeddings,
        documents,
        metadatas
      });

      console.log(`Updated ${vectors.length} vectors in ChromaDB collection`);
    } catch (error) {
      console.error('Failed to update vectors in ChromaDB:', error);
      throw error;
    }
  }

  async getCollectionStats(): Promise<{ count: number; dimension?: number }> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    try {
      const count = await this.collection.count();
      return { count };
    } catch (error) {
      console.error('Failed to get collection stats:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized. Call initialize() first.');
    }

    try {
      // Try to delete all vectors by deleting the collection and recreating it
      const collectionName = this.collectionName;
      const metadata = this.collection.metadata;
      
      // Delete the collection
      await this.client.deleteCollection({ name: collectionName });
      console.log(`Deleted ChromaDB collection '${collectionName}'`);
      
      // Recreate the collection
      this.collection = await this.client.createCollection({
        name: collectionName,
        metadata: metadata || { 'hnsw:space': 'cosine' }
      });
      console.log(`Recreated ChromaDB collection '${collectionName}'`);
    } catch (error) {
      console.error('Failed to clear ChromaDB collection:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // ChromaDB client doesn't have a close method, but we can reset the collection
    this.collection = null;
    console.log('ChromaDB connection closed');
  }
}