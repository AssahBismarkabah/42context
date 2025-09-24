import { CodeParser } from '../analysis/code-parser';
import { EmbeddingService } from './embedding-service';
import { ChromaVectorStore } from './chroma-vector-store';
import {
  CodeVector,
  SearchOptions,
  SearchResult,
  SemanticSearchConfig,
  FileChangeEvent
} from '../core/types';

export class SemanticSearch {
  private parser: CodeParser;
  private embeddingService: EmbeddingService;
  private vectorStore: ChromaVectorStore;
  private config: SemanticSearchConfig;
  private isInitialized: boolean = false;

  constructor(config: SemanticSearchConfig = {}) {
    this.config = {
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      vectorStore: 'chroma',
      chunkSize: 1000,
      chunkOverlap: 200,
      maxResults: 10,
      minSimilarity: 0.7,
      ...config
    };

    this.parser = new CodeParser();
    this.embeddingService = new EmbeddingService();
    
    // Initialize ChromaDB vector store with proper connection parameters
    this.vectorStore = new ChromaVectorStore(
      'code_vectors',
      process.env.CHROMA_HOST || 'localhost',
      parseInt(process.env.CHROMA_PORT || '8000'),
      process.env.CHROMA_SERVER_AUTH_CREDENTIALS || 'test-token'
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Semantic Search...');
      
      // Initialize embedding service
      await this.embeddingService.initialize();
      console.log('Embedding service initialized');

      // Initialize vector store
      await this.vectorStore.initialize();
      console.log('Vector store initialized');

      this.isInitialized = true;
      console.log('Semantic Search initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Semantic Search:', error);
      throw error;
    }
  }

  async indexFile(filePath: string, content: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Semantic Search not initialized. Call initialize() first.');
    }

    try {
      console.log(`Indexing file: ${filePath}`);

      // Parse file and extract code chunks
      const chunks = await this.parser.parseFile(filePath, content);
      console.log(`Extracted ${chunks.length} chunks from ${filePath}`);

      if (chunks.length === 0) return;

      // Generate embeddings for chunks
      const embeddings = await this.embeddingService.generateBatchEmbeddings({ chunks });
      console.log(`Generated ${embeddings.length} embeddings`);

      // Create code vectors with unique IDs
      const codeVectors: CodeVector[] = chunks.map((chunk, index) => ({
        id: `${filePath}_${chunk.type}_${chunk.startLine}_${chunk.startColumn}_${Date.now()}`,
        embedding: embeddings[index].vector,
        content: chunk.content,
        filePath: chunk.filePath,
        language: chunk.language,
        type: chunk.type,
        lineStart: chunk.startLine,
        lineEnd: chunk.endLine,
        timestamp: chunk.timestamp
      }));

      // Delete existing vectors for this file (if any)
      await this.vectorStore.deleteVectors(filePath);

      // Add new vectors to store
      await this.vectorStore.addVectors(codeVectors);
      console.log(`Indexed ${codeVectors.length} vectors for ${filePath}`);

    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error);
      throw error;
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    if (!this.isInitialized) {
      throw new Error('Semantic Search not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      console.log(`Searching for: "${query}"`);

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateTextEmbedding(query);
      console.log('Generated query embedding');

      // Set default options
      const searchOptions = {
        topK: this.config.maxResults || 10,
        minSimilarity: this.config.minSimilarity || 0.7,
        ...options
      };

      // Search for similar vectors
      const searchResults = await this.vectorStore.searchSimilar(
        queryEmbedding,
        searchOptions.topK,
        searchOptions.language
      );

      console.log(`Found ${searchResults.length} raw results`);

      // Filter by minimum similarity and other criteria
      let filteredResults = searchResults.filter(result => 
        result.similarity >= searchOptions.minSimilarity!
      );

      // Apply additional filters
      if (searchOptions.filePath) {
        filteredResults = filteredResults.filter(result => 
          result.filePath.includes(searchOptions.filePath!)
        );
      }

      if (searchOptions.chunkType) {
        filteredResults = filteredResults.filter(result => 
          result.type === searchOptions.chunkType
        );
      }

      // Sort by similarity (highest first)
      filteredResults.sort((a, b) => b.similarity - a.similarity);

      // Limit to topK results
      const finalResults = filteredResults.slice(0, searchOptions.topK);

      const searchTime = Date.now() - startTime;

      console.log(`Returning ${finalResults.length} filtered results in ${searchTime}ms`);

      return {
        results: finalResults,
        query,
        resultCount: finalResults.length,
        searchTime
      };

    } catch (error) {
      console.error(`Search failed for query "${query}":`, error);
      throw error;
    }
  }

  async handleFileChange(event: FileChangeEvent): Promise<void> {
    if (!this.isInitialized) return;

    try {
      switch (event.type) {
        case 'add':
        case 'change':
          if (event.content) {
            await this.indexFile(event.filePath, event.content);
          }
          break;
        case 'delete':
          await this.vectorStore.deleteVectors(event.filePath);
          console.log(`Removed vectors for deleted file: ${event.filePath}`);
          break;
      }
    } catch (error) {
      console.error(`Failed to handle file change event:`, error);
      // Don't throw - file changes shouldn't break the system
    }
  }

  async getIndexStats(): Promise<{
    totalVectors: number;
    embeddingDimension: number;
    collectionName: string;
    indexedFiles: string[];
  }> {
    if (!this.isInitialized) {
      throw new Error('Semantic Search not initialized. Call initialize() first.');
    }

    try {
      const vectorStoreStats = await this.vectorStore.getCollectionStats();
      
      return {
        totalVectors: vectorStoreStats.count,
        embeddingDimension: this.embeddingService.getEmbeddingDimension(),
        collectionName: 'code_vectors',
        indexedFiles: [] // This would need to be tracked separately
      };
    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.close();
    }
    this.isInitialized = false;
  }
}

// Factory function for backward compatibility with tests
export function createSemanticSearchService(config?: SemanticSearchConfig): SemanticSearch {
  return new SemanticSearch(config);
}