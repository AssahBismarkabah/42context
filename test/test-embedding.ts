/**
 * Test for Embedding Service
 */

import { createEmbeddingService } from '../src/ai/embedding-service';
import { CodeChunk } from '../src/storage/code-storage';

// Test data - code chunks
const testChunks: CodeChunk[] = [
  {
    id: 'chunk1',
    type: 'function',
    name: 'calculateSum',
    content: 'function calculateSum(a, b) { return a + b; }',
    filePath: '/test/math.js',
    language: 'javascript',
    startLine: 1,
    endLine: 3,
    startColumn: 0,
    endColumn: 45,
    signature: 'calculateSum(a, b)',
    documentation: 'Calculates the sum of two numbers',
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now()
  },
  {
    id: 'chunk2',
    type: 'function',
    name: 'calculateProduct',
    content: 'function calculateProduct(a, b) { return a * b; }',
    filePath: '/test/math.js',
    language: 'javascript',
    startLine: 5,
    endLine: 7,
    startColumn: 0,
    endColumn: 50,
    signature: 'calculateProduct(a, b)',
    documentation: 'Calculates the product of two numbers',
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now()
  },
  {
    id: 'chunk3',
    type: 'class',
    name: 'Calculator',
    content: 'class Calculator { constructor() { this.value = 0; } add(n) { this.value += n; } }',
    filePath: '/test/math.js',
    language: 'javascript',
    startLine: 10,
    endLine: 15,
    startColumn: 0,
    endColumn: 80,
    signature: 'Calculator',
    documentation: 'A simple calculator class',
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now()
  }
];

async function testEmbeddingService() {
  console.log('🧪 Testing Embedding Service...\n');

  try {
    // Create embedding service
    const embeddingService = createEmbeddingService({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      cacheSize: 1000
    });

    console.log(' Embedding service created');

    // Initialize the service
    console.log('\n Initializing embedding model...');
    await embeddingService.initialize();
    console.log(' Model loaded successfully');

    // Test single embedding generation
    console.log('\n Testing single embedding generation...');
    const embedding1 = await embeddingService.generateEmbedding(testChunks[0]);
    console.log(` Generated embedding for "${testChunks[0].name}"`);
    console.log(`   Dimension: ${embedding1.dimension}`);
    console.log(`   Model: ${embedding1.model}`);

    // Test batch embedding generation
    console.log('\n Testing batch embedding generation...');
    const batchResults = await embeddingService.generateBatchEmbeddings({
      chunks: testChunks,
      batchSize: 2
    });
    console.log(` Generated ${batchResults.length} embeddings in batch`);

    // Test embedding similarity
    console.log('\n Testing embedding similarity...');
    const similarity = embeddingService.calculateSimilarity(
      batchResults[0].vector,
      batchResults[1].vector
    );
    console.log(` Similarity between "${testChunks[0].name}" and "${testChunks[1].name}": ${similarity.toFixed(4)}`);

    // Test finding most similar
    console.log('\n Testing most similar search...');
    const mostSimilar = await embeddingService.findMostSimilar(
      batchResults[0],
      batchResults.slice(1),
      2
    );
    console.log(' Most similar embeddings:');
    mostSimilar.forEach((result: { embedding: any; similarity: number }, index: number) => {
      console.log(`   ${index + 1}. Similarity: ${result.similarity.toFixed(4)}`);
    });

    // Test caching
    console.log('\n Testing embedding cache...');
    const cachedEmbedding = embeddingService.getCachedEmbedding(testChunks[0].id);
    if (cachedEmbedding) {
      console.log(` Found cached embedding for "${testChunks[0].name}"`);
    }

    // Test cache stats
    console.log('\n Testing cache statistics...');
    const cacheStats = embeddingService.getCacheStats();
    console.log(`Cache stats: ${JSON.stringify(cacheStats, null, 2)}`);

    // Test model info
    console.log('\n  Testing model information...');
    const modelInfo = embeddingService.getModelInfo();
    console.log(` Model info: ${JSON.stringify(modelInfo, null, 2)}`);

    console.log('\n All embedding tests completed successfully!');

  } catch (error) {
    console.error(' Embedding test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEmbeddingService().catch(console.error);
}

module.exports = { testEmbeddingService };