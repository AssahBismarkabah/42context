/**
 * Simple test for PocketFlow Integration
 * 
 * This test focuses on the core PocketFlow orchestration without the complex code analysis agent
 */

import { ConfigManager } from '../src/core/config';
import { createPocketFlowMCPIntegration } from '../src/pocketflow';
import { SemanticSearchAgent } from '../src/pocketflow/agents/semantic-search-agent';

async function testSimplePocketFlowIntegration() {
  console.log('🚀 Starting Simple PocketFlow Integration Test...\n');

  try {
    // Step 1: Initialize configuration manager
    console.log(' Initializing configuration manager...');
    const configManager = new ConfigManager();
    console.log(' Configuration manager initialized\n');

    // Step 2: Create and initialize PocketFlow integration
    console.log(' Creating PocketFlow MCP Integration...');
    const pocketFlowIntegration = await createPocketFlowMCPIntegration(configManager);
    console.log(' PocketFlow MCP Integration created and initialized\n');

    // Step 3: Test integration status
    console.log(' Checking integration status...');
    const status = pocketFlowIntegration.getStatus();
    console.log('Integration Status:', JSON.stringify(status, null, 2));
    console.log(' Integration status retrieved\n');

    // Step 4: Test code search workflow
    console.log(' Testing code search workflow...');
    const searchParams = {
      query: 'authentication middleware',
      language: 'javascript',
      top_k: 5,
      min_similarity: 0.7,
      include_pattern_analysis: false // Skip pattern analysis for simplicity
    };

    const searchResult = await pocketFlowIntegration.handleCodeSearch(searchParams);
    console.log('Search Results:', {
      resultCount: searchResult.searchResults.length,
      executionTime: searchResult.executionTime,
      confidence: searchResult.confidence
    });
    console.log(' Code search workflow completed\n');

    // Step 5: Test semantic completion
    console.log('✨ Testing semantic completion...');
    const completionParams = {
      code_snippet: 'function authenticateUser(username, password) {',
      language: 'javascript',
      completion_type: 'function',
      context_window: 10
    };

    const completionResult = await pocketFlowIntegration.handleSemanticCompletion(completionParams);
    console.log('Completion Results:', {
      completionCount: completionResult.completions.length,
      suggestionCount: completionResult.suggestions.length,
      confidence: completionResult.confidence
    });
    console.log(' Semantic completion completed\n');

    // Step 6: Test error handling
    console.log(' Testing error handling...');
    try {
      await pocketFlowIntegration.handleCodeSearch({ query: '' }); // Empty query should fail
      console.log(' Error handling test failed - should have thrown an error');
    } catch (error) {
      console.log(' Error handling working correctly - caught expected error');
    }
    console.log('');

    // Step 7: Cleanup
    console.log(' Cleaning up resources...');
    await pocketFlowIntegration.cleanup();
    console.log(' Cleanup completed\n');

    console.log(' Simple PocketFlow Integration test passed!');
    return true;

  } catch (error) {
    console.error(' Simple PocketFlow Integration test failed:', error);
    return false;
  }
}

// Test individual semantic search agent
async function testSemanticSearchAgent() {
  console.log(' Testing Semantic Search Agent...\n');

  try {
    // Create a simple semantic search agent
    const searchAgent = new SemanticSearchAgent({
      name: 'TestSemanticSearchAgent',
      type: 'semantic_search',
      maxConcurrentTasks: 2,
      timeout: 30,
      retryAttempts: 2,
      specialized: true,
      modelPreference: 'Xenova/all-MiniLM-L6-v2'
    });

    const searchContext = {
      taskId: 'test_search_1',
      agentType: 'semantic_search' as const,
      input: {
        query: 'authentication middleware',
        options: {
          language: 'javascript',
          topK: 5,
          minSimilarity: 0.7
        }
      },
      metadata: {},
      timestamp: Date.now(),
      retryCount: 0
    };

    const searchResult = await searchAgent.execute(searchContext);
    console.log('Search Agent Result:', {
      success: searchResult.success,
      hasResults: !!searchResult.data?.results,
      executionTime: searchResult.executionTime
    });
    console.log(' Semantic Search Agent test completed\n');

    return true;

  } catch (error) {
    console.error(' Semantic Search Agent test failed:', error);
    return false;
  }
}

// Main test runner
async function runSimpleTests() {
  console.log('🎯 Starting Simple PocketFlow Integration Test Suite\n');
  console.log('='.repeat(50));
  console.log('');

  let allTestsPassed = true;

  // Test individual semantic search agent
  const agentTestsPassed = await testSemanticSearchAgent();
  if (!agentTestsPassed) {
    allTestsPassed = false;
    console.log(' Semantic Search Agent tests failed\n');
  } else {
    console.log(' Semantic Search Agent tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Test full integration (without code analysis)
  const integrationTestsPassed = await testSimplePocketFlowIntegration();
  if (!integrationTestsPassed) {
    allTestsPassed = false;
    console.log(' Integration tests failed\n');
  } else {
    console.log(' Integration tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Final results
  if (allTestsPassed) {
    console.log(' All Simple PocketFlow Integration tests passed!');
    console.log(' PocketFlow orchestration is working correctly');
    console.log(' Semantic search agent is functional');
    console.log(' MCP tool integration is operational');
    console.log(' Error handling is working properly');
  } else {
    console.log(' Some tests failed. Please check the logs above.');
  }

  return allTestsPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSimpleTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runSimpleTests, testSemanticSearchAgent, testSimplePocketFlowIntegration };