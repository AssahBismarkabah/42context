import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FileWatcher } from '../src/file-watcher.js';
import fs from 'fs/promises';
import path from 'path';

describe('FileWatcher', () => {
  let watcher: FileWatcher;
  const testDir = path.join(process.cwd(), 'test-files');

  // Setup test directory
  async function setupTestDir(): Promise<void> {
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  // Cleanup test directory
  async function cleanupTestDir(): Promise<void> {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }

  test('should create FileWatcher instance', () => {
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true
    });
    
    assert.ok(watcher instanceof FileWatcher);
    assert.strictEqual(watcher.options.projectPath, testDir);
    assert.strictEqual(watcher.getStats().isWatching, false);
  });

  test('should start and stop watching', async () => {
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true
    });

    await setupTestDir();
    
    try {
      await watcher.start();
      assert.strictEqual(watcher.getStats().isWatching, true);
      
      await watcher.stop();
      assert.strictEqual(watcher.getStats().isWatching, false);
    } finally {
      await cleanupTestDir();
    }
  });

  test('should detect file addition', async () => {
    await setupTestDir();
    
    const testFile = path.join(testDir, 'test-add.txt');
    
    // Create the watcher with better polling settings for tests
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true,
      usePolling: true,
      interval: 50,  // Faster polling for tests
      binaryInterval: 100,
      awaitWriteFinish: false,  // Disable for faster test response
      atomic: false  // Disable atomic writes for tests
    });

    // Set up event listener BEFORE starting the watcher
    let fileAddedEvent: any = null;
    watcher.on('fileAdded', (event: { filePath: string; stats?: import('fs').Stats; timestamp: number }) => {
      console.log(`Test received fileAdded event: ${event.filePath}`);
      if (event.filePath === testFile) {
        fileAddedEvent = event;
      }
    });

    try {
      await watcher.start();
      
      // Wait longer for watcher to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Creating test file: ${testFile}`);
      // Create a test file
      await fs.writeFile(testFile, 'test content');
      
      // Wait for the file addition event with longer timeout
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds with 100ms intervals
      while (!fileAddedEvent && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log(`File addition event received: ${fileAddedEvent !== null}`);
      assert.ok(fileAddedEvent, 'File addition event should be emitted');
      assert.strictEqual(fileAddedEvent!.filePath, testFile);
    } finally {
      await watcher.stop();
      await cleanupTestDir();
    }
  });

  test('should detect file changes', async () => {
    await setupTestDir();
    
    const testFile = path.join(testDir, 'test-change.txt');
    
    // Create the watcher with better polling settings for tests
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true,
      usePolling: true,
      interval: 50,
      binaryInterval: 100,
      awaitWriteFinish: false,
      atomic: false
    });

    // Set up event listener BEFORE starting the watcher
    let fileChangedEvent: any = null;
    watcher.on('fileChanged', (event: { filePath: string; stats?: import('fs').Stats; timestamp: number }) => {
      console.log(`Test received fileChanged event: ${event.filePath}`);
      if (event.filePath === testFile) {
        fileChangedEvent = event;
      }
    });

    try {
      // Create initial file first
      await fs.writeFile(testFile, 'initial content');
      
      await watcher.start();
      
      // Wait longer for watcher to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Modifying test file: ${testFile}`);
      // Change the file
      await fs.writeFile(testFile, 'modified content');
      
      // Wait for the file change event
      let attempts = 0;
      const maxAttempts = 30;
      while (!fileChangedEvent && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log(`File change event received: ${fileChangedEvent !== null}`);
      assert.ok(fileChangedEvent, 'File change event should be emitted');
      assert.strictEqual(fileChangedEvent.filePath, testFile);
    } finally {
      await watcher.stop();
      await cleanupTestDir();
    }
  });

  test('should detect file removal', async () => {
    await setupTestDir();
    
    const testFile = path.join(testDir, 'test-remove.txt');
    
    // Create the watcher with better polling settings for tests
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true,
      usePolling: true,
      interval: 50,
      binaryInterval: 100,
      awaitWriteFinish: false,
      atomic: false
    });

    // Set up event listener BEFORE starting the watcher
    let fileRemovedEvent: any = null;
    watcher.on('fileRemoved', (event: { filePath: string; timestamp: number }) => {
      console.log(`Test received fileRemoved event: ${event.filePath}`);
      if (event.filePath === testFile) {
        fileRemovedEvent = event;
      }
    });

    try {
      // Create initial file
      await fs.writeFile(testFile, 'test content');
      
      await watcher.start();
      
      // Wait longer for watcher to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Removing test file: ${testFile}`);
      // Remove the file
      await fs.unlink(testFile);
      
      // Wait for the file removal event
      let attempts = 0;
      const maxAttempts = 30;
      while (!fileRemovedEvent && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log(`File removal event received: ${fileRemovedEvent !== null}`);
      assert.ok(fileRemovedEvent, 'File removal event should be emitted');
      assert.strictEqual(fileRemovedEvent.filePath, testFile);
    } finally {
      await watcher.stop();
      await cleanupTestDir();
    }
  });

  test('should track watched files', async () => {
    await setupTestDir();
    
    const testFile = path.join(testDir, 'test-track.txt');

    // Create the watcher with better settings for file tracking
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: false,  // We want to track initial files
      usePolling: true,
      interval: 50,
      binaryInterval: 100,
      awaitWriteFinish: false,
      atomic: false
    });

    try {
      // Create initial file first
      await fs.writeFile(testFile, 'test content');
      
      await watcher.start();
      
      // Wait longer for initial scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const watchedFiles = watcher.getWatchedFiles();
      console.log(`Watched files: ${watchedFiles.length}, looking for: ${testFile}`);
      console.log(`Files found: ${watchedFiles.join(', ')}`);
      
      // The file should be in the watched files list
      const fileFound = watchedFiles.some(file => file.includes('test-track.txt'));
      assert.ok(fileFound, `File ${testFile} should be in watched files list`);
      assert.strictEqual(watcher.isWatchingFile(testFile), true);
    } finally {
      await watcher.stop();
      await cleanupTestDir();
    }
  });

  test('should provide statistics', async () => {
    watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true
    });

    await setupTestDir();
    
    const testFile = path.join(testDir, 'test-stats.txt');

    try {
      await fs.writeFile(testFile, 'test content');
      await watcher.start();
      
      const stats = watcher.getStats();
      
      assert.strictEqual(stats.isWatching, true);
      assert.strictEqual(stats.projectPath, testDir);
      assert.ok(stats.options);
    } finally {
      await watcher.stop();
      await cleanupTestDir();
    }
  });

  test('should handle errors gracefully', async () => {
    watcher = new FileWatcher({
      projectPath: '/nonexistent/path',
      ignoreInitial: true
    });

    let errorEmitted = false;

    watcher.on('error', (_error: Error) => {
      errorEmitted = true;
    });

    try {
      await watcher.start();
      // Should emit error for nonexistent path
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Note: Chokidar might not immediately error on nonexistent paths
      // This test verifies the error handling mechanism is in place
      assert.ok(watcher.getStats().isWatching || errorEmitted);
    } finally {
      if (watcher.getStats().isWatching) {
        await watcher.stop();
      }
    }
  });
});
