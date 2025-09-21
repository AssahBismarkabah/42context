/**
 * Test for Code Storage Service
 */

const { CodeStorage: StorageService } = require('../src/code-storage');

// Test data
const testChunks = [
  {
    id: 'chunk1',
    type: 'function' as const,
    name: 'calculateSum',
    content: 'function calculateSum(a, b) { return a + b; }',
    filePath: '/test/math.js',
    language: 'javascript',
    startLine: 1,
    endLine: 3,
    startColumn: 0,
    endColumn: 45,
    signature: 'calculateSum(a, b)',
    documentation: undefined,
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now(),
  },
  {
    id: 'chunk2',
    type: 'class' as const,
    name: 'Calculator',
    content: 'class Calculator { constructor() { this.value = 0; } }',
    filePath: '/test/math.js',
    language: 'javascript',
    startLine: 5,
    endLine: 9,
    startColumn: 0,
    endColumn: 50,
    signature: 'Calculator()',
    documentation: undefined,
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now(),
  },
  {
    id: 'chunk3',
    type: 'function' as const,
    name: 'fibonacci',
    content: 'def fibonacci(n): if n <= 1: return n; return fibonacci(n-1) + fibonacci(n-2)',
    filePath: '/test/math.py',
    language: 'python',
    startLine: 1,
    endLine: 4,
    startColumn: 0,
    endColumn: 60,
    signature: 'fibonacci(n)',
    documentation: undefined,
    dependencies: [],
    metadata: undefined,
    timestamp: Date.now(),
  },
];

async function testCodeStorage() {
  console.log(' Testing Code Storage Service...\n');

  try {
    // Create storage instance
    const storage = new StorageService({
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      persistToDisk: false,
    });

    console.log(' Storage instance created');

    // Test storing chunks
    console.log('\n Testing chunk storage...');
    await storage.storeChunks(testChunks);
    console.log(` Stored ${testChunks.length} chunks`);

    // Test getting stats
    console.log('\n Testing storage statistics...');
    const stats = storage.getStats();
    console.log(` Storage stats: ${JSON.stringify(stats, null, 2)}`);

    // Test searching by file path
    console.log('\n Testing search by file path...');
    const jsChunks = await storage.searchChunks({ filePath: '/test/math.js' });
    console.log(`Found ${jsChunks.length} chunks in /test/math.js`);

    // Test searching by language
    console.log('\n Testing search by language...');
    const pythonChunks = await storage.searchChunks({ language: 'python' });
    console.log(` Found ${pythonChunks.length} Python chunks`);

    // Test searching by type
    console.log('\n Testing search by type...');
    const functionChunks = await storage.searchChunks({ chunkType: 'function' });
    console.log(` Found ${functionChunks.length} function chunks`);

    // Test searching by name
    console.log('\n Testing search by name...');
    const calculatorChunk = await storage.searchChunks({ name: 'Calculator' });
    console.log(` Found ${calculatorChunk.length} chunks named 'Calculator'`);

    // Test content search
    console.log('\n Testing content search...');
    const fibonacciChunks = await storage.searchChunks({ content: 'fibonacci' });
    console.log(` Found ${fibonacciChunks.length} chunks containing 'fibonacci'`);

    // Test getting chunks by file
    console.log('\n Testing get chunks by file...');
    const fileChunks = await storage.getChunksByFile('/test/math.js');
    console.log(` Found ${fileChunks.length} chunks in file`);

    // Test getting chunks by language
    console.log('\n🐍 Testing get chunks by language...');
    const langChunks = await storage.getChunksByLanguage('javascript');
    console.log(` Found ${langChunks.length} JavaScript chunks`);

    // Test getting chunk by ID
    console.log('\n Testing get chunk by ID...');
    const chunk = await storage.getChunkById('chunk1');
    console.log(` Retrieved chunk: ${chunk ? chunk.name : 'null'}`);

    // Test removing chunks by file
    console.log('\n  Testing remove chunks by file...');
    await storage.removeChunksByFile('/test/math.py');
    const remainingPythonChunks = await storage.searchChunks({ language: 'python' });
    console.log(` After removal: ${remainingPythonChunks.length} Python chunks remaining`);

    // Test clearing storage
    console.log('\n🧹 Testing clear storage...');
    await storage.clear();
    const finalStats = storage.getStats();
    console.log(` After clear: ${finalStats.totalChunks} chunks remaining`);

    console.log('\n All storage tests completed successfully!');
  } catch (error) {
    console.error(' Storage test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testCodeStorage().catch(console.error);
}

module.exports = { testCodeStorage };
