/**
 * Test for Vector Store Service
 */

import { ChromaVectorStore } from '../src/ai/chroma-vector-store';
import { EmbeddingService } from '../src/ai/embedding-service';
import { CodeChunk } from '../src/core/types';

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

async function testVectorStore() {
  console.log(' Testing Vector Store Service...\n');

  try {
    // Create embedding service
    const embeddingService = new EmbeddingService({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      cacheSize: 1000
    });

    // Create vector store - connect to Docker ChromaDB
    const vectorStore = new ChromaVectorStore(
      'test_code_embeddings',
      'localhost',
      8000,
      process.env.CHROMA_AUTH_TOKEN || 'test-token'
    );

    console.log(' Vector store created');

    // Initialize services
    console.log('\n Initializing embedding service...');
    await embeddingService.initialize();
    console.log(' Embedding service initialized');

    console.log('\n Initializing vector store...');
    await vectorStore.initialize();
    console.log(' Vector store initialized');

    // Generate embeddings for test chunks
    console.log('\n Generating embeddings for test chunks...');
    const embeddings = await embeddingService.generateBatchEmbeddings({
      chunks: testChunks,
      batchSize: 2
    });
    console.log(` Generated ${embeddings.length} embeddings`);

    // Convert embeddings to CodeVector format for ChromaDB
    const codeVectors = embeddings.map((embedding, index) => ({
      id: testChunks[index].id,
      embedding: embedding.vector,
      content: testChunks[index].content,
      filePath: testChunks[index].filePath,
      language: testChunks[index].language,
      type: testChunks[index].type,
      lineStart: testChunks[index].startLine,
      lineEnd: testChunks[index].endLine,
      timestamp: testChunks[index].timestamp
    }));

    // Store embeddings in vector store
    console.log('\n Storing embeddings in vector store...');
    await vectorStore.addVectors(codeVectors);
    console.log(' Embeddings stored successfully');

    // Test vector search
    console.log('\n Testing vector search...');
    const searchResults = await vectorStore.searchSimilar(
      embeddings[0].vector,
      3
    );
    console.log(` Found ${searchResults.length} similar vectors:`);
    searchResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.type} ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
    });

    // Test filtered search
    console.log('\n Testing filtered vector search...');
    const filteredResults = await vectorStore.searchSimilar(
      embeddings[0].vector,
      2,
      'javascript'
    );
    console.log(` Found ${filteredResults.length} filtered similar vectors:`);
    filteredResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.type} ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
    });

    // Test text-based search
    console.log('\n Testing text-based vector search...');
    const queryChunk: CodeChunk = {
      id: 'query-chunk',
      type: 'function',
      name: 'query',
      content: 'calculate sum of numbers',
      filePath: '/query/test.js',
      language: 'javascript',
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 25,
      signature: 'query()',
      documentation: 'Query chunk for testing',
      dependencies: [],
      metadata: undefined,
      timestamp: Date.now()
    };
    const queryEmbedding = await embeddingService.generateEmbedding(queryChunk);
    const textResults = await vectorStore.searchSimilar(
      queryEmbedding.vector,
      2
    );
    console.log(` Found ${textResults.length} text-based similar vectors:`);
    textResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.type} ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
    });

    // Test vector store stats
    console.log('\nTesting vector store statistics...');
    const stats = await vectorStore.getCollectionStats();
    console.log(` Vector store stats: ${JSON.stringify(stats, null, 2)}`);

    // Test clear functionality
    console.log('\n Testing clear functionality...');
    await vectorStore.clear();
    const clearedStats = await vectorStore.getCollectionStats();
    console.log(` After clear: ${clearedStats.count} vectors remaining`);

    // Test close functionality
    console.log('\n Testing close functionality...');
    await vectorStore.close();
    console.log(' Vector store closed successfully');

    console.log('\n All vector store tests completed successfully!');

  } catch (error) {
    console.error(' Vector store test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testVectorStore().catch(console.error);
}

module.exports = { testVectorStore };