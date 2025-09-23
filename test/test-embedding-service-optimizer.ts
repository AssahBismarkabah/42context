import { EmbeddingService } from '../src/embedding-service';
import { CodeChunk } from '../src/types';

async function testEmbeddingServiceWithOptimizer() {
  console.log(' Testing Embedding Service with Optimizer Integration...\n');

  try {
    // Create embedding service with optimizer enabled
    const embeddingService = new EmbeddingService({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      batchSize: 10,
      cacheSize: 100,
      useOptimizer: true // Enable the new optimizer
    });

    console.log(' Initializing Embedding Service with Optimizer...');
    await embeddingService.initialize();
    console.log(' Embedding Service initialized successfully\n');

    // Create test chunks
    const testChunks: CodeChunk[] = [
      {
        id: 'service-test-1',
        type: 'function',
        name: 'calculateSum',
        content: 'function calculateSum(a, b) { return a + b; }',
        filePath: 'test/math.js',
        language: 'javascript',
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 40,
        signature: 'calculateSum(a, b)',
        documentation: 'Calculates the sum of two numbers',
        dependencies: [],
        metadata: { test: true },
        timestamp: Date.now()
      },
      {
        id: 'service-test-2',
        type: 'class',
        name: 'Calculator',
        content: 'class Calculator { add(a, b) { return a + b; } }',
        filePath: 'test/calculator.js',
        language: 'javascript',
        startLine: 1,
        endLine: 3,
        startColumn: 1,
        endColumn: 50,
        signature: 'class Calculator',
        documentation: 'A simple calculator class',
        dependencies: [],
        metadata: { test: true },
        timestamp: Date.now()
      }
    ];

    console.log(' Testing single embedding generation with service...');
    const singleResult = await embeddingService.generateEmbedding(testChunks[0]);
    console.log(' Single embedding generated successfully');
    console.log(`   - Chunk ID: ${singleResult.chunkId}`);
    console.log(`   - Vector dimension: ${singleResult.dimension}`);
    console.log(`   - Model: ${singleResult.model}\n`);

    console.log(' Testing batch embedding generation with service...');
    const batchRequest = { chunks: testChunks, batchSize: 2 };
    const batchResults = await embeddingService.generateBatchEmbeddings(batchRequest);
    console.log(' Batch embeddings generated successfully');
    console.log(`   - Generated ${batchResults.length} embeddings`);
    batchResults.forEach((result, index) => {
      console.log(`   - Result ${index + 1}: ${result.chunkId} (${result.dimension}D)`);
    });
    console.log();

    // Test cache functionality
    console.log(' Testing cache functionality...');
    const cachedResult = embeddingService.getCachedEmbedding(testChunks[0].id);
    if (cachedResult) {
      console.log(' Cache hit - embedding retrieved from cache');
      console.log(`   - Cached chunk ID: ${cachedResult.chunkId}`);
    } else {
      console.log(' Cache miss - embedding not found in cache');
    }
    console.log();

    // Test cache stats
    const cacheStats = embeddingService.getCacheStats();
    console.log(' Cache statistics:');
    console.log(`   - Cache size: ${cacheStats.cacheSize}`);
    console.log(`   - Max cache size: ${cacheStats.maxCacheSize}`);
    console.log(`   - Model name: ${cacheStats.modelName}`);
    console.log();

    // Test text embedding
    console.log(' Testing text embedding...');
    const textEmbedding = await embeddingService.generateTextEmbedding('function add(a, b) { return a + b; }');
    console.log(' Text embedding generated successfully');
    console.log(`   - Vector dimension: ${textEmbedding.length}`);
    console.log();

    // Test similarity calculation
    console.log(' Testing similarity calculation...');
    const similarity = embeddingService.calculateSimilarity(
      singleResult.vector,
      batchResults[1].vector
    );
    console.log(` Cosine similarity: ${similarity.toFixed(4)}`);
    console.log();

    console.log(' All Embedding Service with Optimizer tests passed!');
    return true;

  } catch (error) {
    console.error(' Embedding Service test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testEmbeddingServiceWithOptimizer().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testEmbeddingServiceWithOptimizer };