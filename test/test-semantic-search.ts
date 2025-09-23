/**
 * Test for Semantic Search Service
 */

import { createSemanticSearchService } from '../src/ai/semantic-search';
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
  },
  {
    id: 'chunk4',
    type: 'function',
    name: 'authenticateUser',
    content: 'function authenticateUser(username, password) { if (!username || !password) return false; return validateCredentials(username, password); }',
    filePath: '/test/auth.js',
    language: 'javascript',
    startLine: 1,
    endLine: 5,
    startColumn: 0,
    endColumn: 120,
    signature: 'authenticateUser(username, password)',
    documentation: 'Authenticates user with username and password',
    dependencies: ['validateCredentials'],
    metadata: undefined,
    timestamp: Date.now()
  },
  {
    id: 'chunk5',
    type: 'function',
    name: 'validateInput',
    content: 'function validateInput(input) { if (!input || input.length === 0) return false; return input.length > 3; }',
    filePath: '/test/validation.js',
    language: 'javascript',
    startLine: 1,
    endLine: 4,
    startColumn: 0,
    endColumn: 90,
    signature: 'validateInput(input)',
    documentation: 'Validates input data',
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now()
  }
];

async function testSemanticSearch() {
  console.log(' Testing Semantic Search Service...\n');

  try {
    // Create semantic search service
    const semanticSearch = createSemanticSearchService({
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      minSimilarity: 0.2,
      maxResults: 5
    });

    console.log(' Semantic search service created');

    // Initialize service
    console.log('\n Initializing semantic search service...');
    await semanticSearch.initialize();
    console.log(' Semantic search service initialized');

    // Index code chunks
    console.log('\n Indexing code chunks...');
    // Index each chunk as a separate file
    for (const chunk of testChunks) {
      await semanticSearch.indexFile(chunk.filePath, chunk.content);
    }
    console.log(' Code chunks indexed successfully');

    // Test 1: Basic semantic search
    console.log('\n Test 1: Basic semantic search');
    const searchResults1 = await semanticSearch.search('calculate sum of numbers', {
      topK: 3
    });
    console.log(` Found ${searchResults1.resultCount} results:`);
    searchResults1.results.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`      File: ${result.filePath}`);
    });

    // Test 2: Filtered search by language
    console.log('\n Test 2: Filtered search by language');
    const searchResults2 = await semanticSearch.search('authentication', {
      language: 'javascript',
      topK: 2
    });
    console.log(` Found ${searchResults2.resultCount} results:`);
    searchResults2.results.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`      File: ${result.filePath}`);
    });

    // Test 3: Search with threshold
    console.log('\n Test 3: Search with higher threshold');
    const searchResults3 = await semanticSearch.search('validation', {
      minSimilarity: 0.3,
      topK: 3
    });
    console.log(` Found ${searchResults3.resultCount} results with threshold 0.3:`);
    searchResults3.results.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`      File: ${result.filePath}`);
    });

    // Test 4: Find similar patterns
    console.log('\n Test 4: Find similar patterns');
    const patternResults = await semanticSearch.search('function validateUser(input) { if (!input) return false; }', {
      language: 'javascript',
      topK: 3
    });
    console.log(` Found ${patternResults.resultCount} similar patterns:`);
    patternResults.results.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`      File: ${result.filePath}`);
    });

    // Test 5: Service statistics
    console.log('\n Test 5: Service statistics');
    const stats = await semanticSearch.getIndexStats();
    console.log(` Service stats: ${JSON.stringify(stats, null, 2)}`);

    // Test 6: Complex search with multiple filters
    console.log('\n Test 6: Complex search with multiple filters');
    const complexResults = await semanticSearch.search('calculate math operations', {
      language: 'javascript',
      chunkType: 'function',
      topK: 2
    });
    console.log(` Found ${complexResults.resultCount} complex filtered results:`);
    complexResults.results.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`      File: ${result.filePath}`);
    });

    console.log('\n All semantic search tests completed successfully!');

  } catch (error) {
    console.error(' Semantic search test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSemanticSearch().catch(console.error);
}

module.exports = { testSemanticSearch };