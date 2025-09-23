import { EmbeddingOptimizer } from '../src/ai/embedding-optimizer';
import { CodeChunk } from '../src/core/types';

async function testEmbeddingOptimizer() {
  console.log(' Testing Embedding Optimizer with Memory Management...\n');

  try {
    // Create optimizer with memory-conscious configuration
    const optimizer = new EmbeddingOptimizer({
      maxConcurrentOperations: 1,
      tensorCleanupIntervalMs: 2000,
      modelRefreshInterval: 60000, // 1 minute for testing
      enableResourcePooling: true,
      maxResourcePoolSize: 2,
      resourceTimeoutMs: 10000
    });

    console.log(' Initializing Embedding Optimizer...');
    await optimizer.initialize();
    console.log(' Embedding Optimizer initialized successfully\n');

    // Create test chunks
    const testChunks: CodeChunk[] = [
      {
        id: 'test-1',
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
        id: 'test-2',
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

    console.log(' Testing single embedding generation...');
    const singleResult = await optimizer.generateEmbedding(testChunks[0]);
    console.log(' Single embedding generated successfully');
    console.log(`   - Chunk ID: ${singleResult.chunkId}`);
    console.log(`   - Vector dimension: ${singleResult.dimension}`);
    console.log(`   - Model: ${singleResult.model}\n`);

    console.log(' Testing batch embedding generation...');
    const batchResults = await optimizer.generateBatchEmbeddings(testChunks);
    console.log(' Batch embeddings generated successfully');
    console.log(`   - Generated ${batchResults.length} embeddings`);
    batchResults.forEach((result, index) => {
      console.log(`   - Result ${index + 1}: ${result.chunkId} (${result.dimension}D)`);
    });
    console.log();

    // Test memory management
    console.log(' Testing memory management...');
    const stats = optimizer.getStats();
    console.log(' Memory management stats:');
    console.log(`   - Model loaded: ${stats.isModelLoaded}`);
    console.log(`   - Model load time: ${stats.modelLoadTime}ms`);
    console.log(`   - Resource pool: ${stats.resourcePool.poolSize} available, ${stats.resourcePool.activeCount} active`);
    console.log(`   - Memory usage: ${stats.memoryManager.current.heapUsedMB}MB heap used`);
    console.log();

    // Test cleanup
    console.log('🧹 Testing cleanup...');
    await optimizer.cleanup();
    console.log(' Cleanup completed successfully\n');

    console.log(' All Embedding Optimizer tests passed!');
    return true;

  } catch (error) {
    console.error(' Embedding Optimizer test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testEmbeddingOptimizer().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testEmbeddingOptimizer };