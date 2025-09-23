import { FileWatcher } from '../src/storage/file-watcher.js';
import fs from 'fs/promises';
import path from 'path';

async function debugWatcher(): Promise<void> {
  const testDir = path.join(process.cwd(), 'debug-test');
  
  try {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    console.log('Creating file watcher...');
    const watcher = new FileWatcher({
      projectPath: testDir,
      ignoreInitial: true,
      usePolling: true,
      interval: 100,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    // Set up event listeners
    watcher.on('fileAdded', (event: { filePath: string; stats?: import('fs').Stats; timestamp: number }) => {
      console.log(' FILE ADDED:', event.filePath);
    });

    watcher.on('fileChanged', (event: { filePath: string; stats?: import('fs').Stats; timestamp: number }) => {
      console.log(' FILE CHANGED:', event.filePath);
    });

    watcher.on('fileRemoved', (event: { filePath: string; timestamp: number }) => {
      console.log(' FILE REMOVED:', event.filePath);
    });

    watcher.on('ready', () => {
      console.log(' Watcher is ready!');
    });

    // Start watching
    console.log('Starting watcher...');
    await watcher.start();
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const testFile = path.join(testDir, 'test.txt');
    
    // Test file addition
    console.log('\n--- Testing file addition ---');
    await fs.writeFile(testFile, 'Hello World');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test file change
    console.log('\n--- Testing file change ---');
    await fs.writeFile(testFile, 'Hello World Modified');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test file removal
    console.log('\n--- Testing file removal ---');
    await fs.unlink(testFile);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Cleanup
    console.log('\n--- Cleaning up ---');
    await watcher.stop();
    await fs.rm(testDir, { recursive: true, force: true });
    
    console.log('Debug complete!');
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

// Run debug
debugWatcher().catch(console.error);