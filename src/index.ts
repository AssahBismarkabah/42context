#!/usr/bin/env node

import { FileWatcher } from './file-watcher.js';
import { program, OptionValues } from 'commander';
import path from 'path';

/**
 * Configuration options for the Context Engine
 */
export interface ContextEngineOptions {
  projectPath: string;
  debug?: boolean;
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
  private isRunning: boolean = false;

  constructor(options: ContextEngineOptions) {
    this.options = options;
  }

  /**
   * Start the context engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Context engine is already running');
      return;
    }

    console.log('Starting MCP Local Context Engine...');
    console.log(`Project path: ${this.options.projectPath}`);

    try {
      // Initialize file watcher
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
      console.log('Context engine started successfully');

      // Keep the process running
      this.keepAlive();
    } catch (error) {
      console.error('Failed to start context engine:', error);
      throw error;
    }
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherHandlers(): void {
    if (!this.fileWatcher) return;

    this.fileWatcher.on('fileAdded', (event) => {
      console.log(`[FILE ADDED] ${event.filePath}`);
      // TODO: Trigger indexing for new files
    });

    this.fileWatcher.on('fileChanged', (event) => {
      console.log(`[FILE CHANGED] ${event.filePath}`);
      // TODO: Trigger re-indexing for changed files
    });

    this.fileWatcher.on('fileRemoved', (event) => {
      console.log(`[FILE REMOVED] ${event.filePath}`);
      // TODO: Remove from index
    });

    this.fileWatcher.on('directoryAdded', (event) => {
      console.log(`[DIRECTORY ADDED] ${event.dirPath}`);
    });

    this.fileWatcher.on('directoryRemoved', (event) => {
      console.log(`[DIRECTORY REMOVED] ${event.dirPath}`);
    });

    this.fileWatcher.on('error', (error) => {
      console.error('[FILE WATCHER ERROR]', error);
    });

    this.fileWatcher.on('ready', () => {
      console.log('[FILE WATCHER] Ready and initial scan complete');
      const watchedFiles = this.fileWatcher?.getWatchedFiles() || [];
      console.log(`Watching ${watchedFiles.length} files`);
    });
  }

  /**
   * Stop the context engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Context engine is not running');
      return;
    }

    console.log('Stopping context engine...');

    try {
      if (this.fileWatcher) {
        await this.fileWatcher.stop();
        this.fileWatcher = null;
      }

      this.isRunning = false;
      console.log('Context engine stopped');
    } catch (error) {
      console.error('Error stopping context engine:', error);
      throw error;
    }
  }

  /**
   * Keep the process alive
   */
  private keepAlive(): void {
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
      fileWatcher: this.fileWatcher ? this.fileWatcher.getStats() : null,
      uptime: process.uptime()
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
      projectPath: path.resolve(options.projectPath as string)
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