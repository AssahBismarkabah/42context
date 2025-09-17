# File Watcher Implementation Documentation

## Overview

The file watcher module provides cross-platform file system monitoring capabilities for the MCP Local Context Engine. It uses the `chokidar` library to provide a unified API across macOS, Linux, and Windows while leveraging native OS file system APIs for optimal performance.

## Architecture

### Core Components

1. **FileWatcher Class** (`src/file-watcher.js`)
   - EventEmitter-based architecture for real-time file system event handling
   - Cross-platform compatibility using native OS APIs
   - Configurable options for different use cases
   - Comprehensive error handling and recovery

2. **Event System**
   - `fileAdded`: Emitted when a new file is created
   - `fileChanged`: Emitted when an existing file is modified
   - `fileRemoved`: Emitted when a file is deleted
   - `directoryAdded`: Emitted when a new directory is created
   - `directoryRemoved`: Emitted when a directory is deleted
   - `ready`: Emitted when initial file system scan is complete
   - `error`: Emitted when file system errors occur

### Configuration Options

```javascript
const watcher = new FileWatcher({
  projectPath: '/path/to/project',        // Root directory to watch
  ignored: ['**/node_modules/**'],        // Patterns to ignore
  persistent: true,                       // Keep process alive
  ignoreInitial: false,                   // Ignore initial add events
  followSymlinks: true,                   // Follow symbolic links
  usePolling: false,                      // Use polling instead of native APIs
  interval: 100,                          // Polling interval (ms)
  awaitWriteFinish: {                     // Wait for write operations to complete
    stabilityThreshold: 2000,
    pollInterval: 100
  },
  depth: undefined,                       // Maximum directory depth to watch
  ignorePermissionErrors: true            // Ignore permission errors
});
```

## Native OS API Support

### macOS
- Uses FSEvents API for efficient file system monitoring
- Provides real-time notifications with low overhead
- Handles large directory trees efficiently

### Linux
- Uses inotify for file system event monitoring
- Falls back to polling for unsupported file systems
- Configurable for different Linux distributions

### Windows
- Uses ReadDirectoryChangesW API
- Provides comprehensive file system change notifications
- Handles long path names and special characters

## Usage Examples

### Basic Usage

```javascript
import { FileWatcher } from './src/file-watcher.js';

const watcher = new FileWatcher({
  projectPath: './my-project',
  ignored: ['**/node_modules/**', '**/.git/**']
});

watcher.on('fileAdded', (event) => {
  console.log(`New file: ${event.filePath}`);
  // Trigger indexing for new files
});

watcher.on('fileChanged', (event) => {
  console.log(`File modified: ${event.filePath}`);
  // Trigger re-indexing for changed files
});

watcher.on('fileRemoved', (event) => {
  console.log(`File deleted: ${event.filePath}`);
  // Remove from index
});

await watcher.start();
```

### CLI Usage

```bash
# Start watching current directory
node src/index.js

# Watch specific project
node src/index.js --project-path /path/to/project

# Enable debug mode
node src/index.js --debug

# Get help
node src/index.js --help
```

## Testing

### Test Coverage

The file watcher includes comprehensive tests covering:

1. **Basic Operations**
   - File creation detection
   - File modification detection
   - File deletion detection
   - Directory creation/deletion detection

2. **Edge Cases**
   - Error handling for non-existent paths
   - Permission error handling
   - Symbolic link handling
   - Large directory tree monitoring

3. **Performance Tests**
   - Concurrent file operations
   - Memory usage monitoring
   - Event emission timing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test test/test-file-watcher.js

# Run debug test
node test/debug-watcher.js
```

## Performance Considerations

### Memory Usage
- Efficient file tracking using Set data structure
- Automatic cleanup of removed files
- Configurable memory limits for large projects

### CPU Usage
- Native OS APIs minimize CPU overhead
- Polling mode available for problematic file systems
- Configurable polling intervals to balance responsiveness vs. CPU usage

### Scalability
- Handles projects with 10,000+ files efficiently
- Incremental scanning for large directory trees
- Configurable depth limits to prevent excessive memory usage

## Error Handling

### Common Issues and Solutions

1. **Permission Errors**
   - Automatically ignored by default (`ignorePermissionErrors: true`)
   - Can be configured to emit errors for debugging

2. **File System Limits**
   - Handles EMFILE (too many open files) gracefully
   - Falls back to polling when native APIs fail
   - Provides clear error messages for troubleshooting

3. **Race Conditions**
   - Uses `awaitWriteFinish` to handle rapid file changes
   - Implements proper event ordering
   - Prevents duplicate events for the same file operation

## Integration with Context Engine

The file watcher is designed to integrate seamlessly with the broader context engine:

1. **Event-Driven Architecture**: Emits events that trigger indexing and analysis workflows
2. **Incremental Updates**: Only processes changed files to minimize overhead
3. **Error Recovery**: Continues operation even when individual files fail
4. **Statistics**: Provides monitoring data for system health tracking

## Future Enhancements

1. **Advanced Filtering**: Support for complex file patterns and content-based filtering
2. **Batch Processing**: Group related file changes for efficient processing
3. **Network File Systems**: Enhanced support for NFS, SMB, and cloud storage
4. **Performance Metrics**: Detailed performance monitoring and optimization
5. **Configuration Hot-Reload**: Dynamic configuration changes without restart

## Troubleshooting

### Common Issues

1. **Events Not Firing**
   - Check file permissions
   - Verify `ignoreInitial` setting
   - Ensure adequate polling interval
   - Check ignored patterns

2. **High CPU Usage**
   - Reduce polling frequency
   - Limit watched directory depth
   - Use more specific ignore patterns
   - Consider native API mode

3. **Memory Leaks**
   - Ensure proper cleanup with `stop()`
   - Check for event listener leaks
   - Monitor watched file count
   - Use depth limits for large projects

### Debug Mode

Enable debug mode to get detailed logging:
```javascript
const watcher = new FileWatcher({
  projectPath: './project',
  // ... other options
});

// Enable debug logging
watcher.on('raw', (event) => {
  console.log('Raw event:', event);
});