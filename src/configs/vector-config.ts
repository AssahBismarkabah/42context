/**
 * Vector database configuration and factory
 * Supports both ChromaDB and Faiss with a unified interface
 */

import { VectorStore } from '../storage/vector-store.js';

/**
 * Vector database type
 */
export type VectorDatabaseType = 'chromadb' | 'faiss';

/**
 * Configuration for vector database
 */
export interface VectorDatabaseConfig {
  type: VectorDatabaseType;
  collectionName?: string;
  persistDirectory?: string;
  embeddingModel?: string;
  distanceMetric?: 'cosine' | 'l2' | 'ip';
  // ChromaDB specific options
  chromaHost?: string;
  chromaPort?: number;
  // Faiss specific options
  faissIndexType?: 'flat' | 'ivf' | 'hnsw';
  faissUseGpu?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_VECTOR_CONFIG: VectorDatabaseConfig = {
  type: 'chromadb',
  collectionName: 'code_chunks',
  persistDirectory: './.vector-store',
  embeddingModel: 'all-MiniLM-L6-v2',
  distanceMetric: 'cosine',
  chromaHost: 'localhost',
  chromaPort: 8000,
  faissIndexType: 'flat',
  faissUseGpu: false
};

/**
 * Create vector store based on configuration
 */
export async function createVectorStore(config: VectorDatabaseConfig): Promise<VectorStore> {
  const mergedConfig = { ...DEFAULT_VECTOR_CONFIG, ...config };

  switch (mergedConfig.type) {
    case 'chromadb':
      return createChromaVectorStore(mergedConfig);
    
    case 'faiss':
      return createFaissVectorStore(mergedConfig);
    
    default:
      throw new Error(`Unsupported vector database type: ${mergedConfig.type}`);
  }
}

/**
 * Create ChromaDB vector store
 */
async function createChromaVectorStore(config: VectorDatabaseConfig): Promise<VectorStore> {
  const vectorStore = new VectorStore({
    collectionName: config.collectionName || DEFAULT_VECTOR_CONFIG.collectionName!,
    persistDirectory: config.persistDirectory || DEFAULT_VECTOR_CONFIG.persistDirectory!,
    embeddingModel: config.embeddingModel || DEFAULT_VECTOR_CONFIG.embeddingModel!,
    distanceMetric: config.distanceMetric || DEFAULT_VECTOR_CONFIG.distanceMetric!
  });

  await vectorStore.initialize();
  return vectorStore;
}

/**
 * Create Faiss vector store (placeholder for future implementation)
 */
async function createFaissVectorStore(config: VectorDatabaseConfig): Promise<VectorStore> {
  // TODO: Implement Faiss integration
  // For now, fall back to ChromaDB with a warning
  console.warn('Faiss integration not yet implemented, falling back to ChromaDB');
  return createChromaVectorStore(config);
}

/**
 * Load configuration from file or environment
 */
export function loadVectorConfig(): VectorDatabaseConfig {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), '.vector-config.json');
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...DEFAULT_VECTOR_CONFIG, ...fileConfig };
    }
  } catch (error) {
    console.warn('Failed to load vector config file, using defaults:', error);
  }

  // Check environment variables
  const envConfig: Partial<VectorDatabaseConfig> = {};
  
  if (process.env.VECTOR_DB_TYPE) {
    envConfig.type = process.env.VECTOR_DB_TYPE as VectorDatabaseType;
  }
  if (process.env.VECTOR_COLLECTION_NAME) {
    envConfig.collectionName = process.env.VECTOR_COLLECTION_NAME;
  }
  if (process.env.VECTOR_PERSIST_DIR) {
    envConfig.persistDirectory = process.env.VECTOR_PERSIST_DIR;
  }
  if (process.env.VECTOR_EMBEDDING_MODEL) {
    envConfig.embeddingModel = process.env.VECTOR_EMBEDDING_MODEL;
  }
  if (process.env.VECTOR_DISTANCE_METRIC) {
    envConfig.distanceMetric = process.env.VECTOR_DISTANCE_METRIC as 'cosine' | 'l2' | 'ip';
  }

  return { ...DEFAULT_VECTOR_CONFIG, ...envConfig };
}

/**
 * Save configuration to file
 */
export function saveVectorConfig(config: VectorDatabaseConfig): void {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), '.vector-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Vector configuration saved to .vector-config.json');
  } catch (error) {
    console.error('Failed to save vector configuration:', error);
  }
}

/**
 * Validate configuration
 */
export function validateVectorConfig(config: VectorDatabaseConfig): boolean {
  if (!config.type || !['chromadb', 'faiss'].includes(config.type)) {
    console.error('Invalid vector database type');
    return false;
  }

  if (!config.collectionName || config.collectionName.trim() === '') {
    console.error('Invalid collection name');
    return false;
  }

  if (!config.persistDirectory || config.persistDirectory.trim() === '') {
    console.error('Invalid persist directory');
    return false;
  }

  if (!config.embeddingModel || config.embeddingModel.trim() === '') {
    console.error('Invalid embedding model');
    return false;
  }

  if (!config.distanceMetric || !['cosine', 'l2', 'ip'].includes(config.distanceMetric)) {
    console.error('Invalid distance metric');
    return false;
  }

  return true;
}