import { FileWatcher, FileWatcherOptions } from '../src/file-watcher';
import { CodeStorage } from '../src/code-storage';
import { createSemanticSearchService } from '../src/semantic-search';
import * as fs from 'fs';
import * as path from 'path';

async function testIntegration() {
  console.log('\n Testing Full Integration: File Watcher → Parser → Storage → Semantic Search\n');

  const testDir = './test-integration-temp';
  const testFile = path.join(testDir, 'test-code.js');
  let fileWatcher: FileWatcher | null = null;

  try {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Initialize all components
    console.log('1. Initializing components...');

    const { CodeParser } = require('../src/code-parser');
    const parser = new CodeParser();
    const storage = new CodeStorage();
    const semanticSearch = createSemanticSearchService();
    const fileWatcherOptions: FileWatcherOptions = {
      projectPath: testDir,
      ignored: ['**/node_modules/**', '**/.git/**'],
    };
    fileWatcher = new FileWatcher(fileWatcherOptions);

    await semanticSearch.initialize();

    console.log(' All components initialized');

    // Set up file change handler
    const handleFileChange = async (event: any) => {
      console.log(`\n File changed: ${path.basename(event.filePath)}`);

      try {
        // Read the file content
        const content = fs.readFileSync(event.filePath, 'utf8');

        // Parse the code
        const chunks = await parser.parseFile(event.filePath, content);
        console.log(`   Parsed ${chunks.length} code chunks`);

        // Store in storage
        await storage.storeChunks(chunks);
        const stats = storage.getStats();
        console.log(`   Stored in cache with ${stats.totalChunks} total chunks`);

        // Index for semantic search
        for (const chunk of chunks) {
          await semanticSearch.indexFile(chunk.filePath, chunk.content);
        }
        console.log(`   Indexed ${chunks.length} chunks for semantic search`);
      } catch (error) {
        console.error(`   Error processing file: ${error}`);
      }
    };

    // Start watching
    fileWatcher.on('fileChanged', handleFileChange);
    await fileWatcher.start();
    console.log(' File watcher started');

    // Test 1: Create initial file
    console.log('\n2. Test 1: Creating initial file...');
    const initialCode = `
function calculateSum(a, b) {
    return a + b;
}

function calculateProduct(x, y) {
    return x * y;
}

class Calculator {
    constructor() {
        this.result = 0;
    }
    
    add(value) {
        this.result += value;
        return this;
    }
    
    multiply(value) {
        this.result *= value;
        return this;
    }
    
    getResult() {
        return this.result;
    }
}
        `;

    fs.writeFileSync(testFile, initialCode);
    console.log(' Initial file created');

    // Manually process the initial file since ignoreInitial is true
    console.log(' Processing initial file manually...');
    await handleFileChange({ filePath: testFile });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test semantic search
    console.log('\n3. Testing semantic search on indexed code...');

    const searchResult = await semanticSearch.search('calculate sum of numbers');
    console.log(`   Found ${searchResult.resultCount} relevant results:`);
    searchResult.results.forEach((result: any, index: number) => {
      console.log(
        `   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`
      );
      console.log(`      File: ${result.filePath}`);
    });

    // Test 2: Update file with new code
    console.log('\n4. Test 2: Updating file with authentication code...');
    const updatedCode = `
function calculateSum(a, b) {
    return a + b;
}

function calculateProduct(x, y) {
    return x * y;
}

class Calculator {
    constructor() {
        this.result = 0;
    }
    
    add(value) {
        this.result += value;
        return this;
    }
    
    multiply(value) {
        this.result *= value;
        return this;
    }
    
    getResult() {
        return this.result;
    }
}

function authenticateUser(username, password) {
    if (!username || !password) {
        throw new Error('Username and password are required');
    }
    
    // Simple authentication logic
    return username === 'admin' && password === 'secret';
}

function validateInput(input) {
    if (typeof input !== 'string') {
        return false;
    }
    
    return input.length > 0 && input.length <= 100;
}
        `;

    fs.writeFileSync(testFile, updatedCode);
    console.log(' File updated with authentication code');

    // Manually process the updated file
    console.log(' Processing updated file manually...');
    await handleFileChange({ filePath: testFile });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test semantic search for authentication
    console.log('\n5. Testing semantic search for authentication...');

    const authResult = await semanticSearch.search('user authentication login');
    console.log(`   Found ${authResult.resultCount} relevant results:`);
    authResult.results.forEach((result: any, index: number) => {
      console.log(
        `   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`
      );
      console.log(`      File: ${result.filePath}`);
    });

    // Test 3: Search for validation patterns
    console.log('\n6. Test 3: Searching for validation patterns...');

    const validationResult = await semanticSearch.search('input validation check');
    console.log(`   Found ${validationResult.resultCount} relevant results:`);
    validationResult.results.forEach((result: any, index: number) => {
      console.log(
        `   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`
      );
      console.log(`      File: ${result.filePath}`);
    });

    // Test 4: Find similar patterns
    console.log('\n7. Test 4: Finding similar patterns...');

    // Test 4: Find similar patterns (already implemented above)
    console.log('\n7. Test 4: Finding similar patterns...');

    const similarResult = await semanticSearch.search('error handling middleware pattern', {
      topK: 5,
      minSimilarity: 0.6,
    });
    console.log(`   Found ${similarResult.resultCount} similar patterns:`);
    similarResult.results.forEach((result: any, index: number) => {
      console.log(
        `   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`
      );
      console.log(`      File: ${result.filePath}`);
    });

    // Test 5: Service statistics
    console.log('\n8. Service Statistics:');
    const stats = await semanticSearch.getIndexStats();
    console.log(
      `   - Vector store: ${stats.totalVectors} vectors, ${stats.embeddingDimension} dimensions`
    );
    const storageStats = storage.getStats();
    console.log(
      `   - Files in storage: ${storageStats.fileCount} files, ${storageStats.totalChunks} chunks`
    );
    console.log(`   - Collection name: ${stats.collectionName}`);

    // Test 6: Complex search with filters
    console.log('\n9. Test 6: Complex search with language filter...');

    const complexResult = await semanticSearch.search('calculate math', {
      language: 'javascript',
      topK: 3,
      minSimilarity: 0.2,
    });
    console.log(`   Found ${complexResult.resultCount} filtered results:`);
    complexResult.results.forEach((result: any, index: number) => {
      console.log(
        `   ${index + 1}. ${result.content.substring(0, 50)}... (similarity: ${result.similarity.toFixed(4)})`
      );
    });

    console.log('\n All integration tests completed successfully!');
  } catch (error) {
    console.error(' Integration test failed:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    if (fileWatcher) {
      await fileWatcher.stop();
    }

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    console.log(' Cleanup completed');
  }
}

// Run the integration test
if (require.main === module) {
  testIntegration().catch(console.error);
}

export { testIntegration };
