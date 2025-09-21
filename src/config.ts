import { readFileSync, existsSync } from 'fs';
import { LogLevel } from './logger.js';

export interface EmbeddingConfig {
  modelName: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

export interface VectorStoreConfig {
  type: 'chroma' | 'faiss' | 'memory';
  collectionName: string;
  host?: string;
  port?: number;
  authToken?: string;
  embeddingDimension: number;
  maxVectorsPerFile: number;
  similarityThreshold: number;
}

export interface FileWatcherConfig {
  ignored: string[];
  persistent: boolean;
  ignoreInitial: boolean;
  usePolling: boolean;
  interval: number;
  awaitWriteFinish: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  maxFileSize: number; // in bytes
}

export interface ParserConfig {
  maxFileSize: number; // in bytes
  chunkSize: number;
  chunkOverlap: number;
  supportedLanguages: string[];
  extractDocumentation: boolean;
  extractDependencies: boolean;
}

export interface SemanticSearchConfig {
  maxResults: number;
  minSimilarity: number;
  defaultLanguage?: string;
  enableCaching: boolean;
  cacheSize: number;
}

export interface LoggingConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFile?: string;
  maxFileSize: number;
  maxFiles: number;
}

export interface PerformanceConfig {
  maxConcurrentOperations: number;
  batchProcessingSize: number;
  memoryLimit: number; // in MB
  cpuLimit: number; // percentage
  enableResourceMonitoring: boolean;
}

export interface SecurityConfig {
  enableSandbox: boolean;
  allowedFileExtensions: string[];
  maxFileSize: number;
  enableContentFiltering: boolean;
}

export interface ContextEngineConfig {
  projectPath: string;
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  fileWatcher: FileWatcherConfig;
  parser: ParserConfig;
  semanticSearch: SemanticSearchConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
}

const DEFAULT_CONFIG: ContextEngineConfig = {
  projectPath: process.cwd(),
  embedding: {
    modelName: 'Xenova/all-MiniLM-L6-v2',
    batchSize: 32,
    maxRetries: 3,
    retryDelay: 1000,
  },
  vectorStore: {
    type: 'chroma',
    collectionName: 'code_vectors',
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000'),
    authToken: process.env.CHROMA_SERVER_AUTH_CREDENTIALS || 'test-token',
    embeddingDimension: 384,
    maxVectorsPerFile: 1000,
    similarityThreshold: 0.7,
  },
  fileWatcher: {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.log',
      '**/coverage/**',
      '**/.env*',
      '**/package-lock.json',
      '**/yarn.lock',
    ],
    persistent: true,
    ignoreInitial: false,
    usePolling: false,
    interval: 100,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  parser: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    chunkSize: 1000,
    chunkOverlap: 200,
    supportedLanguages: [
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'rust',
      'go',
      'ruby',
      'php',
    ],
    extractDocumentation: true,
    extractDependencies: true,
  },
  semanticSearch: {
    maxResults: 10,
    minSimilarity: 0.7,
    enableCaching: true,
    cacheSize: 1000,
  },
  logging: {
    level: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  },
  performance: {
    maxConcurrentOperations: 10,
    batchProcessingSize: 32,
    memoryLimit: 2048, // 2GB
    cpuLimit: 80, // 80%
    enableResourceMonitoring: true,
  },
  security: {
    enableSandbox: true,
    allowedFileExtensions: [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.rs',
      '.go',
      '.rb',
      '.php',
    ],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    enableContentFiltering: true,
  },
};

export class ConfigManager {
  private config: ContextEngineConfig;
  private configPath?: string | undefined;

  constructor(configPath?: string) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  private loadConfig(): ContextEngineConfig {
    // Start with default config
    let config = { ...DEFAULT_CONFIG };

    // Load from config file if provided
    if (this.configPath && existsSync(this.configPath)) {
      try {
        const fileConfig = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        config = this.mergeConfig(config, fileConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}:`, error);
      }
    }

    // Load from environment variables
    config = this.loadFromEnvironment(config);

    // Validate configuration
    this.validateConfig(config);

    return config;
  }

  private validateConfig(config: ContextEngineConfig): void {
    // Basic validation
    if (config.embedding.batchSize <= 0) {
      throw new Error('Embedding batch size must be positive');
    }
    if (config.vectorStore.embeddingDimension <= 0) {
      throw new Error('Embedding dimension must be positive');
    }
    if (config.performance.maxConcurrentOperations <= 0) {
      throw new Error('Max concurrent operations must be positive');
    }
    if (config.performance.memoryLimit <= 0) {
      throw new Error('Memory limit must be positive');
    }
  }

  private mergeConfig(defaultConfig: ContextEngineConfig, userConfig: any): ContextEngineConfig {
    const merged = { ...defaultConfig };

    // Deep merge for nested objects
    if (userConfig.embedding) {
      merged.embedding = { ...merged.embedding, ...userConfig.embedding };
    }
    if (userConfig.vectorStore) {
      merged.vectorStore = { ...merged.vectorStore, ...userConfig.vectorStore };
    }
    if (userConfig.fileWatcher) {
      merged.fileWatcher = { ...merged.fileWatcher, ...userConfig.fileWatcher };
    }
    if (userConfig.parser) {
      merged.parser = { ...merged.parser, ...userConfig.parser };
    }
    if (userConfig.semanticSearch) {
      merged.semanticSearch = { ...merged.semanticSearch, ...userConfig.semanticSearch };
    }
    if (userConfig.logging) {
      merged.logging = { ...merged.logging, ...userConfig.logging };
    }
    if (userConfig.performance) {
      merged.performance = { ...merged.performance, ...userConfig.performance };
    }
    if (userConfig.security) {
      merged.security = { ...merged.security, ...userConfig.security };
    }

    // Override top-level properties
    if (userConfig.projectPath) {
      merged.projectPath = userConfig.projectPath;
    }

    return merged;
  }

  private loadFromEnvironment(config: ContextEngineConfig): ContextEngineConfig {
    const env = process.env;

    // Project path
    if (env.DEV_CONTEXT_PROJECT_PATH) {
      config.projectPath = env.DEV_CONTEXT_PROJECT_PATH;
    }

    // Embedding config
    if (env.DEV_CONTEXT_EMBEDDING_MODEL) {
      config.embedding.modelName = env.DEV_CONTEXT_EMBEDDING_MODEL;
    }
    if (env.DEV_CONTEXT_EMBEDDING_BATCH_SIZE) {
      config.embedding.batchSize = parseInt(env.DEV_CONTEXT_EMBEDDING_BATCH_SIZE);
    }

    // Vector store config
    if (env.DEV_CONTEXT_VECTOR_STORE_TYPE) {
      config.vectorStore.type = env.DEV_CONTEXT_VECTOR_STORE_TYPE as 'chroma' | 'faiss' | 'memory';
    }
    if (env.DEV_CONTEXT_VECTOR_STORE_HOST) {
      config.vectorStore.host = env.DEV_CONTEXT_VECTOR_STORE_HOST;
    }
    if (env.DEV_CONTEXT_VECTOR_STORE_PORT) {
      config.vectorStore.port = parseInt(env.DEV_CONTEXT_VECTOR_STORE_PORT || '8000');
    }
    if (env.DEV_CONTEXT_VECTOR_STORE_AUTH_TOKEN) {
      config.vectorStore.authToken = env.DEV_CONTEXT_VECTOR_STORE_AUTH_TOKEN;
    }

    // File watcher config
    if (env.DEV_CONTEXT_MAX_FILE_SIZE) {
      const maxSize = parseInt(env.DEV_CONTEXT_MAX_FILE_SIZE);
      config.fileWatcher.maxFileSize = maxSize;
      config.parser.maxFileSize = maxSize;
      config.security.maxFileSize = maxSize;
    }

    // Logging config
    if (env.DEV_CONTEXT_LOG_LEVEL) {
      const levelMap: Record<string, LogLevel> = {
        error: LogLevel.ERROR,
        warn: LogLevel.WARN,
        info: LogLevel.INFO,
        debug: LogLevel.DEBUG,
        trace: LogLevel.TRACE,
      };
      config.logging.level = levelMap[env.DEV_CONTEXT_LOG_LEVEL.toLowerCase()] ?? LogLevel.INFO;
    }
    if (env.DEV_CONTEXT_LOG_FILE) {
      config.logging.logFile = env.DEV_CONTEXT_LOG_FILE;
      config.logging.enableFile = true;
    }

    // Performance config
    if (env.DEV_CONTEXT_MAX_CONCURRENT_OPERATIONS) {
      config.performance.maxConcurrentOperations = parseInt(
        env.DEV_CONTEXT_MAX_CONCURRENT_OPERATIONS
      );
    }
    if (env.DEV_CONTEXT_MEMORY_LIMIT) {
      config.performance.memoryLimit = parseInt(env.DEV_CONTEXT_MEMORY_LIMIT);
    }

    return config;
  }

  getConfig(): ContextEngineConfig {
    return this.config;
  }

  getEmbeddingConfig(): EmbeddingConfig {
    return this.config.embedding;
  }

  getVectorStoreConfig(): VectorStoreConfig {
    return this.config.vectorStore;
  }

  getFileWatcherConfig(): FileWatcherConfig {
    return this.config.fileWatcher;
  }

  getParserConfig(): ParserConfig {
    return this.config.parser;
  }

  getSemanticSearchConfig(): SemanticSearchConfig {
    return this.config.semanticSearch;
  }

  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  getPerformanceConfig(): PerformanceConfig {
    return this.config.performance;
  }

  getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  updateConfig(updates: Partial<ContextEngineConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig(this.config);
  }
}

// Global config manager instance
let globalConfigManager: ConfigManager | null = null;

export function createConfigManager(configPath?: string): ConfigManager {
  return new ConfigManager(configPath);
}

export function setGlobalConfigManager(configManager: ConfigManager): void {
  globalConfigManager = configManager;
}

export function getGlobalConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

export default ConfigManager;
