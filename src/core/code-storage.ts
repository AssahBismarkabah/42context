/**
 * Code Storage Service for efficient caching and retrieval of parsed code chunks
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Code chunk interface (matching code-parser)
 */
interface CodeChunk {
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

/**
 * Search query for code chunks
 */
interface SearchQuery {
  filePath?: string;
  language?: string;
  chunkType?: string;
  name?: string;
  content?: string;
  limit?: number;
  offset?: number;
}

/**
 * Storage options for code chunks
 */
interface StorageOptions {
  maxMemorySize?: number;
  persistToDisk?: boolean;
  storagePath?: string;
}

/**
 * Simple Code Storage Service
 */
class CodeStorage {
  private memoryCache: Map<string, CodeChunk>;
  private fileIndex: Map<string, string[]>;
  private languageIndex: Map<string, string[]>;
  private typeIndex: Map<string, string[]>;
  private readonly options: Required<StorageOptions>;

  constructor(options: StorageOptions = {}) {
    this.options = {
      maxMemorySize: options.maxMemorySize || 50 * 1024 * 1024, // 50MB default
      persistToDisk: options.persistToDisk || false,
      storagePath: options.storagePath || './.code-storage'
    };

    this.memoryCache = new Map();
    this.fileIndex = new Map();
    this.languageIndex = new Map();
    this.typeIndex = new Map();

    this.initializeStorage();
  }

  /**
   * Initialize storage system
   */
  private async initializeStorage(): Promise<void> {
    if (this.options.persistToDisk) {
      const fs = require('fs');
      if (!fs.existsSync(this.options.storagePath)) {
        fs.mkdirSync(this.options.storagePath, { recursive: true });
      }
    }
  }

  /**
   * Store code chunks
   */
  async storeChunks(chunks: CodeChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.storeChunk(chunk);
    }
  }

  /**
   * Store a single code chunk
   */
  async storeChunk(chunk: CodeChunk): Promise<void> {
    const chunkId = chunk.id || uuidv4();
    const storedChunk = { ...chunk, id: chunkId };

    // Store in memory cache
    this.memoryCache.set(chunkId, storedChunk);

    // Update indices
    this.updateIndices(chunkId, storedChunk);

    // Persist to disk if enabled
    if (this.options.persistToDisk) {
      await this.persistChunkToDisk(storedChunk);
    }
  }

  /**
   * Update search indices
   */
  private updateIndices(chunkId: string, chunk: CodeChunk): void {
    // File index
    if (!this.fileIndex.has(chunk.filePath)) {
      this.fileIndex.set(chunk.filePath, []);
    }
    this.fileIndex.get(chunk.filePath)!.push(chunkId);

    // Language index
    if (!this.languageIndex.has(chunk.language)) {
      this.languageIndex.set(chunk.language, []);
    }
    this.languageIndex.get(chunk.language)!.push(chunkId);

    // Type index
    if (!this.typeIndex.has(chunk.type)) {
      this.typeIndex.set(chunk.type, []);
    }
    this.typeIndex.get(chunk.type)!.push(chunkId);
  }

  /**
   * Persist chunk to disk
   */
  private async persistChunkToDisk(chunk: CodeChunk): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const chunkFile = path.join(this.options.storagePath, `${chunk.id}.json`);
      fs.writeFileSync(chunkFile, JSON.stringify(chunk));
    } catch (error) {
      console.error('Failed to persist chunk to disk:', error);
    }
  }

  /**
   * Search code chunks by query
   */
  async searchChunks(query: SearchQuery): Promise<CodeChunk[]> {
    const startTime = Date.now();
    
    // Start with all chunk IDs
    let candidateIds = new Set(this.memoryCache.keys());

    // Filter by file path
    if (query.filePath) {
      const fileChunks = this.fileIndex.get(query.filePath) || [];
      candidateIds = new Set([...candidateIds].filter(id => fileChunks.includes(id)));
    }

    // Filter by language
    if (query.language) {
      const languageChunks = this.languageIndex.get(query.language) || [];
      candidateIds = new Set([...candidateIds].filter(id => languageChunks.includes(id)));
    }

    // Filter by chunk type
    if (query.chunkType) {
      const typeChunks = this.typeIndex.get(query.chunkType) || [];
      candidateIds = new Set([...candidateIds].filter(id => typeChunks.includes(id)));
    }

    // Filter by name
    if (query.name) {
      const results: CodeChunk[] = [];
      for (const chunkId of candidateIds) {
        const chunk = this.memoryCache.get(chunkId);
        if (chunk && chunk.name === query.name) {
          results.push(chunk);
        }
      }
      candidateIds = new Set(results.map(c => c.id));
    }

    // Filter by content (simple text search)
    if (query.content) {
      const results: CodeChunk[] = [];
      for (const chunkId of candidateIds) {
        const chunk = this.memoryCache.get(chunkId);
        if (chunk && chunk.content.toLowerCase().includes(query.content.toLowerCase())) {
          results.push(chunk);
        }
      }
      candidateIds = new Set(results.map(c => c.id));
    }

    // Retrieve chunks
    const results: CodeChunk[] = [];
    const chunkIds = Array.from(candidateIds);
    const limit = query.limit || chunkIds.length;
    const offset = query.offset || 0;

    for (let i = offset; i < Math.min(offset + limit, chunkIds.length); i++) {
      const chunk = this.memoryCache.get(chunkIds[i]);
      if (chunk) {
        results.push(chunk);
      }
    }

    const searchTime = Date.now() - startTime;
    console.log(`Search completed in ${searchTime}ms, found ${results.length} chunks`);

    return results;
  }

  /**
   * Get chunks by file path
   */
  async getChunksByFile(filePath: string): Promise<CodeChunk[]> {
    return this.searchChunks({ filePath });
  }

  /**
   * Get chunks by language
   */
  async getChunksByLanguage(language: string): Promise<CodeChunk[]> {
    return this.searchChunks({ language });
  }

  /**
   * Get a specific chunk by ID
   */
  async getChunkById(chunkId: string): Promise<CodeChunk | null> {
    return this.memoryCache.get(chunkId) || null;
  }

  /**
   * Remove chunks for a specific file
   */
  async removeChunksByFile(filePath: string): Promise<void> {
    const chunkIds = this.fileIndex.get(filePath) || [];
    for (const chunkId of chunkIds) {
      this.memoryCache.delete(chunkId);
    }
    this.fileIndex.delete(filePath);
  }

  /**
   * Get storage statistics
   */
  getStats(): { totalChunks: number; memoryUsage: number; fileCount: number } {
    return {
      totalChunks: this.memoryCache.size,
      memoryUsage: this.getCurrentMemoryUsage(),
      fileCount: this.fileIndex.size
    };
  }

  /**
   * Get current memory usage estimate
   */
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const chunk of this.memoryCache.values()) {
      totalSize += JSON.stringify(chunk).length;
    }
    return totalSize;
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.fileIndex.clear();
    this.languageIndex.clear();
    this.typeIndex.clear();
  }
}

/**
 * CommonJS exports
 */
module.exports = { CodeStorage };
