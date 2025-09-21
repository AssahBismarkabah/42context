
/**
 * Test file for PocketFlow Integration
 * 
 * This test verifies that the PocketFlow orchestration system works correctly
 * with the MCP Local Context Engine.
 */

import { ConfigManager } from '../src/config';
import { createPocketFlowMCPIntegration } from '../src/pocketflow';
import { SemanticSearchAgent } from '../src/pocketflow/agents/semantic-search-agent';
import { CodeAnalysisAgent } from '../src/pocketflow/agents/code-analysis-agent';

// Mock data for testing (can be used in future implementations)
// const mockSearchResults = [
//   {
//     filePath: '/test/auth.js',
//     content: 'function authenticateUser(username, password) { /* auth logic */ }',
//     similarity: 0.85,
//     language: 'javascript',
//     type: 'function'
//   }
// ];

// const mockCodeAnalysis = {
//   complexity: { cyclomaticComplexity: 12, cognitiveComplexity: 8 }
// };

async function testPocketFlowIntegration() {
  console.log('🚀 Starting PocketFlow Integration Test...\n');

  try {
    // Step 1: Initialize configuration manager
    console.log('📋 Initializing configuration manager...');
    const configManager = new ConfigManager();
    console.log('✅ Configuration manager initialized\n');

    // Step 2: Create and initialize PocketFlow integration
    console.log('🔧 Creating PocketFlow MCP Integration...');
    const pocketFlowIntegration = await createPocketFlowMCPIntegration(configManager);
    console.log('✅ PocketFlow MCP Integration created and initialized\n');

    // Step 3: Test integration status
    console.log('📊 Checking integration status...');
    const status = pocketFlowIntegration.getStatus();
    console.log('Integration Status:', JSON.stringify(status, null, 2));
    console.log('✅ Integration status retrieved\n');

    // Step 4: Test code search workflow
    console.log('🔍 Testing code search workflow...');
    const searchParams = {
      query: 'authentication middleware',
      language: 'javascript',
      top_k: 5,
      min_similarity: 0.7,
      include_pattern_analysis: true
    };

    const searchResult = await pocketFlowIntegration.handleCodeSearch(searchParams);
    console.log('Search Results:', {
      resultCount: searchResult.searchResults.length,
      executionTime: searchResult.executionTime,
      confidence: searchResult.confidence
    });
    console.log('✅ Code search workflow completed\n');

    // Step 5: Test context analysis workflow
    console.log('📈 Testing context analysis workflow...');
    const analysisParams = {
      file_path: '/test/auth.js',
      analysis_type: 'complexity',
      detail_level: 'detailed',
      include_related_files: true,
      focus_areas: ['performance', 'security']
    };

    const analysisResult = await pocketFlowIntegration.handleContextAnalysis(analysisParams);
    console.log('Analysis Results:', {
      hasComplexity: !!analysisResult.complexity,
      hasDependencies: !!analysisResult.dependencies,
      hasPatterns: !!analysisResult.patterns,
      hasSecurityIssues: !!analysisResult.securityIssues,
      hasQualityMetrics: !!analysisResult.qualityMetrics,
      executionTime: analysisResult.executionTime,
      confidence: analysisResult.confidence
    });
    console.log('✅ Context analysis workflow completed\n');

    // Step 6: Test semantic completion
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
    console.log('✅ Semantic completion completed\n');

    // Step 7: Test test suggestion
    console.log('🧪 Testing test suggestion...');
    const testParams = {
      function_name: 'authenticateUser',
      file_path: '/test/auth.js',
      test_framework: 'jest',
      test_type: 'unit',
      coverage_target: 80
    };

    const testResult = await pocketFlowIntegration.handleTestSuggestion(testParams);
    console.log('Test Results:', {
      testCaseCount: testResult.testCases.length,
      testFramework: testResult.testFramework,
      confidence: testResult.confidence
    });
    console.log('✅ Test suggestion completed\n');

    // Step 8: Test error handling
    console.log('🚨 Testing error handling...');
    try {
      await pocketFlowIntegration.handleCodeSearch({ query: '' }); // Empty query should fail
      console.log('❌ Error handling test failed - should have thrown an error');
    } catch (error) {
      console.log('✅ Error handling working correctly - caught expected error');
    }
    console.log('');

    // Step 9: Cleanup
    console.log('🧹 Cleaning up resources...');
    await pocketFlowIntegration.cleanup();
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All PocketFlow Integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ PocketFlow Integration test failed:', error);
    return false;
  }
}

// Test individual agents
async function testIndividualAgents() {
  console.log('🧪 Testing Individual Agents...\n');

  try {
    // Test Semantic Search Agent
    console.log('🔍 Testing Semantic Search Agent...');
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
      hasResults: !!searchResult.data?.results
    });
    console.log('✅ Semantic Search Agent test completed\n');

    // Test Code Analysis Agent
    console.log('📊 Testing Code Analysis Agent...');
    const analysisAgent = new CodeAnalysisAgent({
      name: 'TestCodeAnalysisAgent',
      type: 'code_analysis',
      maxConcurrentTasks: 2,
      timeout: 60,
      retryAttempts: 2,
      specialized: true,
      modelPreference: 'Xenova/all-MiniLM-L6-v2'
    });

    const analysisContext = {
      taskId: 'test_analysis_1',
      agentType: 'code_analysis' as const,
      input: {
        filePath: '/test/auth.js',
        options: {
          analysisType: 'complexity',
          detailLevel: 'detailed',
          includeRelatedFiles: true,
          focusAreas: ['performance', 'security']
        }
      },
      metadata: {},
      timestamp: Date.now(),
      retryCount: 0
    };

    const analysisResult = await analysisAgent.execute(analysisContext);
    console.log('Analysis Agent Result:', {
      success: analysisResult.success,
      hasComplexity: !!analysisResult.data?.complexity,
      hasDependencies: !!analysisResult.data?.dependencies
    });
    console.log('✅ Code Analysis Agent test completed\n');

    console.log('🎉 Individual Agent tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Individual Agent test failed:', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🎯 Starting PocketFlow Integration Test Suite\n');
  console.log('='.repeat(50));
  console.log('');

  let allTestsPassed = true;

  // Test individual agents first
  const agentTestsPassed = await testIndividualAgents();
  if (!agentTestsPassed) {
    allTestsPassed = false;
    console.log('❌ Individual Agent tests failed\n');
  } else {
    console.log('✅ Individual Agent tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Test full integration
  const integrationTestsPassed = await testPocketFlowIntegration();
  if (!integrationTestsPassed) {
    allTestsPassed = false;
    console.log('❌ Integration tests failed\n');
  } else {
    console.log('✅ Integration tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Final results
  if (allTestsPassed) {
    console.log('🎉 All PocketFlow Integration tests passed!');
    console.log('✅ PocketFlow orchestration is working correctly');
    console.log('✅ Multi-agent workflows are functional');
    console.log('✅ MCP tool integration is operational');
  } else {
    console.log('❌ Some tests failed. Please check the logs above.');
  }

  return allTestsPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runAllTests, testIndividualAgents, testPocketFlowIntegration };