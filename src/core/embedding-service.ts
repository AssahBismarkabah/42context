/**
 * Embedding Service for generating vector embeddings from code chunks
 * Uses a simple mock implementation for now due to ESM module issues
 */

/**
 * Configuration for embedding service
 */
export interface EmbeddingConfig {
  modelName?: string;
  maxLength?: number;
  batchSize?: number;
}

/**
 * Mock Embedding Service - generates random embeddings for testing
 * In a real implementation, this would use @xenova/transformers
 */
export class EmbeddingService {
  private readonly config: Required<EmbeddingConfig>;
  private isInitialized: boolean = false;
  private embeddingDimension: number = 384; // Dimension for all-MiniLM-L6-v2

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      modelName: config.modelName || 'all-MiniLM-L6-v2',
      maxLength: config.maxLength || 512,
      batchSize: config.batchSize || 32
    };
  }

  /**
   * Initialize the embedding service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // For now, we'll use a mock implementation
      // In production, this would load the actual transformer model
      console.log(`Embedding service initialized with mock model: ${this.config.modelName}`);
      console.log('Note: Using mock embeddings for testing. Install @xenova/transformers for real embeddings.');

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize embedding service:', error);
      throw new Error(`Embedding service initialization failed: ${error}`);
    }
  }

  /**
   * Generate mock embeddings for a list of texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate deterministic mock embeddings based on text content
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        const embedding = this.generateMockEmbedding(text);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate mock embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Generate deterministic mock embedding based on text content
   */
  private generateMockEmbedding(text: string): number[] {
    const embedding: number[] = [];
    
    // Use text hash to generate consistent embeddings
    const hash = this.simpleHash(text);
    
    // Generate embedding vector with consistent values based on text content
    for (let i = 0; i < this.embeddingDimension; i++) {
      // Use hash to generate pseudo-random but consistent values
      const value = Math.sin(hash * (i + 1)) * 0.5 + 0.5; // Range: 0-1
      embedding.push(value);
    }

    return embedding;
  }

  /**
   * Simple hash function for text
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
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
   * Get embedding dimension
   */
  async getEmbeddingDimension(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.embeddingDimension;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}

/**
 * Global embedding service instance
 */
let globalEmbeddingService: EmbeddingService | null = null;

/**
 * Get or create global embedding service
 */
export function getEmbeddingService(config?: EmbeddingConfig): EmbeddingService {
  if (!globalEmbeddingService) {
    globalEmbeddingService = new EmbeddingService(config);
  }
  return globalEmbeddingService;
}

/**
 * Generate embeddings for texts (convenience function)
 */
export async function generateEmbedding(texts: string[]): Promise<number[][]> {
  const service = getEmbeddingService();
  return service.generateEmbeddings(texts);
}