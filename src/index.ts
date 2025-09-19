#!/usr/bin/env node

import { FileWatcher } from './file-watcher.js';
import { SemanticSearch } from './semantic-search.js';
import { ConfigManager } from './config.js';
import { getGlobalLogger, LogLevel } from './logger.js';
import { program, OptionValues } from 'commander';
import path from 'path';
import { readFileSync } from 'fs';

// Re-export types from types.ts
export * from './types.js';

/**
 * Configuration options for the Context Engine
 */
export interface ContextEngineOptions {
  projectPath: string;
  debug?: boolean;
  configPath?: string;
}

/**
 * Statistics about the context engine
 */
export interface ContextEngineStats {
  isRunning: boolean;
  fileWatcher: import('./file-watcher.js').FileWatcherStats | null;
  uptime: number;
}

/**
 * Main entry point for the MCP Local Context Engine
 */
export class ContextEngine {
  private options: ContextEngineOptions;
  private fileWatcher: FileWatcher | null = null;
  private semanticSearch: SemanticSearch | null = null;
  private configManager: ConfigManager;
  private logger = getGlobalLogger();
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(options: ContextEngineOptions) {
    this.options = options;
    this.configManager = new ConfigManager(options.configPath);
    
    // Configure logging based on debug mode
    if (options.debug) {
      this.logger.setLevel(LogLevel.DEBUG);
    }
  }

  /**
   * Start the context engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.info('Context engine is already running');
      return;
    }

    this.logger.info('Starting MCP Local Context Engine...');
    this.logger.info(`Project path: ${this.options.projectPath}`);

    try {
      // Initialize configuration
      const config = this.configManager.getConfig();
      this.logger.debug('Configuration loaded', { config });

      // Initialize semantic search service
      this.semanticSearch = new SemanticSearch(config.semanticSearch);
      await this.semanticSearch.initialize();
      this.logger.info('Semantic search service initialized');

      // Initialize file watcher with configuration
      this.fileWatcher = new FileWatcher({
        projectPath: this.options.projectPath,
        ignoreInitial: false,
        persistent: true
      });

      // Set up file watcher event handlers
      this.setupFileWatcherHandlers();

      // Start watching files
      await this.fileWatcher.start();

      this.isRunning = true;
      this.logger.info('Context engine started successfully');

      // Perform initial indexing of existing files
      await this.performInitialIndexing();

      // Keep the process running
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error('Failed to start context engine:', error);
      throw error;
    }
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherHandlers(): void {
    if (!this.fileWatcher) return;

    this.fileWatcher.on('fileAdded', async (event) => {
      this.logger.info(`[FILE ADDED] ${event.filePath}`);
      await this.handleFileAdded(event.filePath);
    });

    this.fileWatcher.on('fileChanged', async (event) => {
      this.logger.info(`[FILE CHANGED] ${event.filePath}`);
      await this.handleFileChanged(event.filePath);
    });

    this.fileWatcher.on('fileRemoved', async (event) => {
      this.logger.info(`[FILE REMOVED] ${event.filePath}`);
      await this.handleFileRemoved(event.filePath);
    });

    this.fileWatcher.on('directoryAdded', (event) => {
      this.logger.info(`[DIRECTORY ADDED] ${event.dirPath}`);
    });

    this.fileWatcher.on('directoryRemoved', (event) => {
      this.logger.info(`[DIRECTORY REMOVED] ${event.dirPath}`);
    });

    this.fileWatcher.on('error', (error) => {
      this.logger.error('[FILE WATCHER ERROR]', error);
    });

    this.fileWatcher.on('ready', () => {
      this.logger.info('[FILE WATCHER] Ready and initial scan complete');
      const watchedFiles = this.fileWatcher?.getWatchedFiles() || [];
      this.logger.info(`Watching ${watchedFiles.length} files`);
    });
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    if (!this.semanticSearch) return;

    try {
      this.logger.debug(`Processing new file: ${filePath}`);
      
      // Check if file is supported based on extension
      if (!this.isSupportedFile(filePath)) {
        this.logger.debug(`Skipping unsupported file: ${filePath}`);
        return;
      }

      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      
      // Check file size limit
      const config = this.configManager.getConfig();
      if (content.length > config.security.maxFileSize) {
        this.logger.warn(`File too large, skipping: ${filePath}`);
        return;
      }

      // Index the file
      await this.semanticSearch.indexFile(filePath, content);
      this.logger.info(`Successfully indexed new file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to index new file ${filePath}:`, error);
      // Don't throw - file indexing failures shouldn't break the system
    }
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    if (!this.semanticSearch) return;

    try {
      this.logger.debug(`Processing changed file: ${filePath}`);
      
      // Check if file is supported
      if (!this.isSupportedFile(filePath)) {
        return;
      }

      // Read updated content
      const content = readFileSync(filePath, 'utf-8');
      
      // Check file size limit
      const config = this.configManager.getConfig();
      if (content.length > config.security.maxFileSize) {
        this.logger.warn(`File too large, skipping re-index: ${filePath}`);
        return;
      }

      // Re-index the file (semantic search will handle update logic)
      await this.semanticSearch.indexFile(filePath, content);
      this.logger.info(`Successfully re-indexed changed file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to re-index changed file ${filePath}:`, error);
      // Don't throw - file re-indexing failures shouldn't break the system
    }
  }

  private async handleFileRemoved(filePath: string): Promise<void> {
    if (!this.semanticSearch) return;

    try {
      this.logger.debug(`Processing removed file: ${filePath}`);
      
      // Remove from vector index
      await this.semanticSearch.handleFileChange({
        type: 'delete',
        filePath: filePath,
        language: 'unknown'
      });
      this.logger.info(`Successfully removed file from index: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to remove file from index ${filePath}:`, error);
      // Don't throw - file removal failures shouldn't break the system
    }
  }

  private isSupportedFile(filePath: string): boolean {
    const supportedExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  private async performInitialIndexing(): Promise<void> {
    if (!this.semanticSearch || !this.fileWatcher) return;

    try {
      this.logger.info('Performing initial indexing of existing files...');
      
      const watchedFiles = this.fileWatcher.getWatchedFiles();
      const supportedFiles = watchedFiles.filter(file => this.isSupportedFile(file));
      
      this.logger.info(`Found ${supportedFiles.length} supported files to index`);
      
      // Index files in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < supportedFiles.length; i += batchSize) {
        const batch = supportedFiles.slice(i, i + batchSize);
        this.logger.debug(`Indexing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(supportedFiles.length / batchSize)}`);
        
        await Promise.all(batch.map(async (filePath) => {
          try {
            const content = readFileSync(filePath, 'utf-8');
            await this.semanticSearch!.indexFile(filePath, content);
          } catch (error) {
            this.logger.error(`Failed to index file ${filePath} during initial indexing:`, error);
          }
        }));
      }
      
      this.logger.info('Initial indexing completed');
    } catch (error) {
      this.logger.error('Failed to perform initial indexing:', error);
      // Don't throw - initial indexing failure shouldn't prevent startup
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.info('Context engine is not running');
      return;
    }

    this.logger.info('Stopping context engine...');

    try {
      if (this.fileWatcher) {
        await this.fileWatcher.stop();
        this.fileWatcher = null;
      }

      if (this.semanticSearch) {
        await this.semanticSearch.close();
        this.semanticSearch = null;
      }

      this.isRunning = false;
      this.logger.info('Context engine stopped');
    } catch (error) {
      this.logger.error('Error stopping context engine:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    console.log('Press Ctrl+C to stop the context engine');
  }
  

  /**
   * Get engine statistics
   */
  getStats(): ContextEngineStats {
    return {
      isRunning: this.isRunning,
      fileWatcher: this.fileWatcher?.getStats() || null,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

}

// CLI Setup
program
  .name('mcp-local-context-engine')
  .description('MCP-Based Local Development Context Engine')
  .version('0.1.0')
  .option('-p, --project-path <path>', 'Project path to watch', process.cwd())
  .option('-d, --debug', 'Enable debug mode')
  .action(async (options: OptionValues) => {
    if (options.debug) {
      console.log('Debug mode enabled');
      console.log('Options:', options);
    }

    const engine = new ContextEngine({
      projectPath: path.resolve(options.projectPath as string),
      debug: options.debug
    });

    try {
      await engine.start();
    } catch (error) {
      console.error('Failed to start context engine:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show engine statistics')
  .action(() => {
    // This would need to communicate with a running instance
    console.log('Stats command - implementation pending');
  });

// Parse command line arguments
program.parse();

// Export for module usage
export default ContextEngine;