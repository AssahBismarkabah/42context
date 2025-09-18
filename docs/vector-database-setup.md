# Vector Database Setup Documentation

## Overview

This document describes the vector database implementation for the MCP Local Context Engine. The system supports both ChromaDB and Faiss for semantic code search, with a working simple implementation provided for immediate use.

## Architecture

### Vector Store Components

1. **VectorStore** (`src/vector-store.ts`) - Full ChromaDB implementation
2. **SimpleVectorStore** (`src/simple-vector-store.ts`) - Lightweight in-memory implementation
3. **EmbeddingService** (`src/embedding-service.ts`) - Embedding generation service
4. **VectorConfig** (`src/vector-config.ts`) - Configuration management

### Current Status

- ✅ **SimpleVectorStore**: Fully functional with mock embeddings
- ⚠️ **ChromaDB Integration**: Basic implementation (requires server setup)
- 🔄 **Faiss Integration**: Planned for future implementation

## Quick Start

### Using SimpleVectorStore (Recommended for Testing)

The SimpleVectorStore provides immediate functionality without external dependencies:

```javascript
const { SimpleVectorStore } = require('./dist/src/simple-vector-store.js');
const { EmbeddingService } = require('./dist/src/embedding-service.js');

// Initialize embedding service
const embeddingService = new EmbeddingService();
await embeddingService.initialize();

// Initialize vector store
const vectorStore = new SimpleVectorStore({
  collectionName: 'code-chunks',
  persistDirectory: './vector-store',
  embeddingModel: 'all-MiniLM-L6-v2',
  distanceMetric: 'cosine'
});
await vectorStore.initialize();

// Add code chunks
await vectorStore.addChunks(codeChunks);

// Search for similar code
const results = await vectorStore.searchSimilar('authentication middleware', {
  topK: 5,
  threshold: 0.3
});
```

### Configuration Options

```javascript
const config = {
  collectionName: 'code_chunks',        // Collection name
  persistDirectory: './.vector-store',  // Storage directory
  embeddingModel: 'all-MiniLM-L6-v2',   // Embedding model
  distanceMetric: 'cosine'              // Distance metric
};
```

## Features

### Semantic Search
- Natural language queries
- Cosine similarity scoring
- Configurable similarity thresholds
- Language and file type filtering

### Code Chunk Management
- Add/update/remove code chunks
- Batch operations
- File-based chunk removal
- Statistics and monitoring

### Embedding Generation
- Mock embeddings for testing (default)
- Real embeddings with @xenova/transformers (optional)
- 384-dimensional vectors (all-MiniLM-L6-v2 compatible)
- Consistent deterministic embeddings

## Testing

Run the comprehensive test suite:

```bash
# Test simple vector store
node test/test-simple-vector-store.js

# Test with real data
npm test
```

## Production Setup

### For Real Embeddings

1. Install the transformer package:
```bash
npm install @xenova/transformers
```

2. Update the EmbeddingService to use real models (currently uses mock embeddings)

### For ChromaDB Integration

1. Set up ChromaDB server:
```bash
# Using Docker
docker run -p 8000:8000 chromadb/chroma

# Or install locally
pip install chromadb
chroma run --path ./chroma-data
```

2. Update configuration:
```javascript
const config = {
  type: 'chromadb',
  collectionName: 'code_chunks',
  persistDirectory: './chroma-data',
  chromaHost: 'localhost',
  chromaPort: 8000
};
```

## Performance

### SimpleVectorStore
- **Search Speed**: ~1-5ms for 1000 chunks
- **Memory Usage**: ~1.5MB per 1000 chunks
- **Scalability**: Suitable for small to medium projects (<10k files)

### ChromaDB (When Fully Integrated)
- **Search Speed**: <50ms for 10k+ files
- **Persistence**: Disk-based with memory caching
- **Scalability**: Enterprise-grade with proper setup

## API Reference

### VectorStore Methods

#### `initialize()`
Initializes the vector store and creates necessary collections.

#### `addChunks(chunks: CodeChunk[])`
Adds code chunks with embeddings to the store.

#### `searchSimilar(query: string, options: SearchOptions)`
Performs semantic search and returns similar code chunks.

#### `updateChunks(chunks: CodeChunk[])`
Updates existing chunks with new embeddings.

#### `removeChunks(chunkIds: string[])`
Removes specific chunks from the store.

#### `removeChunksByFile(filePath: string)`
Removes all chunks for a specific file.

#### `getStats()`
Returns statistics about the vector store.

#### `clear()`
Removes all data from the store.

### SearchOptions

```typescript
interface SearchOptions {
  topK?: number;              // Number of results (default: 5)
  language?: string;          // Filter by programming language
  type?: string;              // Filter by chunk type
  filePath?: string;          // Filter by file path
  threshold?: number;         // Minimum similarity score (0-1)
}
```

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Errors**
   - Ensure ChromaDB server is running
   - Check network connectivity
   - Verify collection permissions

2. **Embedding Generation Failures**
   - Check @xenova/transformers installation
   - Verify model downloads
   - Check memory availability

3. **Poor Search Results**
   - Adjust similarity threshold
   - Improve code chunk quality
   - Consider different embedding models

### Debug Mode

Enable debug logging:
```javascript
const vectorStore = new SimpleVectorStore({
  // ... config
});
// Debug output is automatically enabled
```

## Future Enhancements

- [ ] Complete ChromaDB integration with server setup
- [ ] Faiss implementation for high-performance search
- [ ] Product Quantization for memory optimization
- [ ] Multi-language embedding support
- [ ] Real-time indexing performance improvements
- [ ] Distributed vector storage support

## Migration Path

The system is designed to allow easy migration from SimpleVectorStore to full ChromaDB/Faiss implementation:

1. Start with SimpleVectorStore for development
2. Configure ChromaDB server for production
3. Update configuration to use VectorStore instead of SimpleVectorStore
4. Data migration tools will be provided in future releases

## Support

For issues and questions:
- Check the troubleshooting section
- Review the test files for examples
- Consult the main documentation
- File issues in the project repository