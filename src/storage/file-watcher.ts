import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { Stats } from 'fs';

/**
 * Configuration options for the FileWatcher
 */
export interface FileWatcherOptions {
  projectPath?: string;
  ignored?: string[] | string;
  persistent?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  alwaysStat?: boolean;
  depth?: number;
  awaitWriteFinish?: boolean | {
    stabilityThreshold?: number;
    pollInterval?: number;
  };
  ignorePermissionErrors?: boolean;
  atomic?: boolean;
}

/**
 * Event data emitted when a file is added
 */
export interface FileAddedEvent {
  filePath: string;
  stats?: Stats;
  timestamp: number;
}

/**
 * Event data emitted when a file is changed
 */
export interface FileChangedEvent {
  filePath: string;
  stats?: Stats;
  timestamp: number;
}

/**
 * Event data emitted when a file is removed
 */
export interface FileRemovedEvent {
  filePath: string;
  timestamp: number;
}

/**
 * Event data emitted when a directory is added
 */
export interface DirectoryAddedEvent {
  dirPath: string;
  stats?: Stats;
  timestamp: number;
}

/**
 * Event data emitted when a directory is removed
 */
export interface DirectoryRemovedEvent {
  dirPath: string;
  timestamp: number;
}

/**
 * Raw event data for debugging
 */
export interface RawEvent {
  event: string;
  path: string;
  details: any;
}

/**
 * Statistics about the file watcher
 */
export interface FileWatcherStats {
  isWatching: boolean;
  watchedFileCount: number;
  projectPath: string;
  options: FileWatcherOptions;
}

/**
 * Cross-platform file system watcher using Chokidar
 * Supports macOS, Linux, and Windows with native APIs
 */
export class FileWatcher extends EventEmitter {
  public readonly options: Required<FileWatcherOptions>;
  private watcher: FSWatcher | null = null;
  private isWatching: boolean = false;
  private watchedFiles: Set<string> = new Set();

  constructor(options: FileWatcherOptions = {}) {
    super();
    
    this.options = {
      projectPath: options.projectPath || process.cwd(),
      ignored: options.ignored || [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      persistent: options.persistent !== false,
      ignoreInitial: options.ignoreInitial !== false,
      followSymlinks: options.followSymlinks !== false,
      usePolling: options.usePolling || false,
      interval: options.interval || 100,
      binaryInterval: options.binaryInterval || 300,
      alwaysStat: options.alwaysStat || false,
      depth: options.depth || undefined,
      awaitWriteFinish: options.awaitWriteFinish || {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignorePermissionErrors: options.ignorePermissionErrors !== false,
      atomic: options.atomic || true,
      ...options
    } as Required<FileWatcherOptions>;
  }

  /**
   * Start watching the project directory
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log('File watcher is already running');
      return;
    }

    console.log(`Starting file watcher for: ${this.options.projectPath}`);

    try {
      this.watcher = chokidar.watch(this.options.projectPath, {
        ignored: this.options.ignored,
        persistent: this.options.persistent,
        ignoreInitial: this.options.ignoreInitial,
        followSymlinks: this.options.followSymlinks,
        usePolling: this.options.usePolling,
        interval: this.options.interval,
        binaryInterval: this.options.binaryInterval,
        alwaysStat: this.options.alwaysStat,
        depth: this.options.depth,
        awaitWriteFinish: this.options.awaitWriteFinish,
        ignorePermissionErrors: this.options.ignorePermissionErrors,
        atomic: this.options.atomic
      });

      this.setupEventHandlers();
      this.isWatching = true;
      
      console.log('File watcher started successfully');
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for file system events
   */
  private setupEventHandlers(): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (filePath: string, stats?: Stats) => {
        console.log(`File added: ${filePath}`);
        this.watchedFiles.add(filePath);
        this.emit('fileAdded', { filePath, stats, timestamp: Date.now() } as FileAddedEvent);
      })
      .on('change', (filePath: string, stats?: Stats) => {
        console.log(`File changed: ${filePath}`);
        this.emit('fileChanged', { filePath, stats, timestamp: Date.now() } as FileChangedEvent);
      })
      .on('unlink', (filePath: string) => {
        console.log(`File removed: ${filePath}`);
        this.watchedFiles.delete(filePath);
        this.emit('fileRemoved', { filePath, timestamp: Date.now() } as FileRemovedEvent);
      })
      .on('addDir', (dirPath: string, stats?: Stats) => {
        console.log(`Directory added: ${dirPath}`);
        this.emit('directoryAdded', { dirPath, stats, timestamp: Date.now() } as DirectoryAddedEvent);
      })
      .on('unlinkDir', (dirPath: string) => {
        console.log(`Directory removed: ${dirPath}`);
        this.emit('directoryRemoved', { dirPath, timestamp: Date.now() } as DirectoryRemovedEvent);
      })
      .on('error', (error: Error) => {
        console.error('File watcher error:', error);
        this.emit('error', error);
      })
      .on('ready', () => {
        console.log('File watcher is ready and scanning complete');
        this.emit('ready');
      })
      .on('raw', (event: string, path: string, details: any) => {
        // Raw event for debugging
        this.emit('raw', { event, path, details } as RawEvent);
      });
  }

  /**
   * Stop watching and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      console.log('File watcher is not running');
      return;
    }

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      this.watchedFiles.clear();
      
      console.log('File watcher stopped successfully');
    } catch (error) {
      console.error('Error stopping file watcher:', error);
      throw error;
    }
  }

  /**
   * Get list of currently watched files
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles);
  }

  /**
   * Check if a specific file is being watched
   */
  isWatchingFile(filePath: string): boolean {
    return this.watchedFiles.has(filePath);
  }

  /**
   * Add a specific file or directory to watch
   */
  addPath(filePath: string): void {
    if (this.watcher) {
      this.watcher.add(filePath);
    }
  }

  /**
   * Remove a specific file or directory from watching
   */
  removePath(filePath: string): void {
    if (this.watcher) {
      this.watcher.unwatch(filePath);
    }
  }

  /**
   * Get watcher statistics
   */
  getStats(): FileWatcherStats {
    return {
      isWatching: this.isWatching,
      watchedFileCount: this.watchedFiles.size,
      projectPath: this.options.projectPath,
      options: this.options
    };
  }
}

/**
 * Factory function to create a file watcher instance
 */
export function createFileWatcher(options: FileWatcherOptions = {}): FileWatcher {
  return new FileWatcher(options);
}

/**
 * Default export
 */
export default FileWatcher;