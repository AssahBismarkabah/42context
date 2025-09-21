export interface CodeChunk {
  id: string;
  type: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'import' | 'export';
  name: string;
  content: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  signature: string | undefined;
  documentation: string | undefined;
  dependencies: string[];
  metadata: Record<string, any> | undefined;
  timestamp: number;
}

export interface CodeVector {
  id: string;
  embedding: number[];
  content: string;
  filePath: string;
  language: string;
  type: string;
  lineStart: number;
  lineEnd: number;
  timestamp: number;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  filePath: string;
  language: string;
  type: string;
  lineStart: number;
  lineEnd: number;
  similarity: number;
  timestamp: number;
}

export interface VectorStore {
  initialize(): Promise<void>;
  addVectors(vectors: CodeVector[]): Promise<void>;
  searchSimilar(
    queryVector: number[],
    topK?: number,
    language?: string
  ): Promise<VectorSearchResult[]>;
  deleteVectors(filePath: string): Promise<void>;
  updateVectors(vectors: CodeVector[]): Promise<void>;
  getCollectionStats(): Promise<{ count: number; dimension?: number }>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export interface EmbeddingService {
  generateEmbedding(chunk: CodeChunk): Promise<EmbeddingResult>;
  generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResult[]>;
  generateTextEmbedding(text: string): Promise<number[]>;
  getEmbeddingDimension(): number;
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

export interface SearchOptions {
  topK?: number;
  language?: string;
  filePath?: string;
  chunkType?: string;
  minSimilarity?: number;
}

export interface SearchResult {
  results: VectorSearchResult[];
  query: string;
  resultCount: number;
  searchTime: number;
}

export interface SemanticSearchConfig {
  embeddingModel?: string;
  vectorStore?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  maxResults?: number;
  minSimilarity?: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'delete';
  filePath: string;
  content?: string;
  language: string;
}
