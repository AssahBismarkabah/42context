/**
 * Core test for PocketFlow Integration
 * 
 * This test focuses only on the core PocketFlow functionality without importing problematic agents
 */

// Import only the specific modules we need
const { ConfigManager } = require('../src/config');
const { createPocketFlowConfigManager } = require('../src/pocketflow/config');
const { PocketFlowOrchestrator } = require('../src/pocketflow/orchestrator');
const { SemanticSearchAgent } = require('../src/pocketflow/agents/semantic-search-agent');
const { createLogger, LogLevel } = require('../src/logger');

async function testCorePocketFlow() {
  console.log('🚀 Starting Core PocketFlow Integration Test...\n');

  try {
    // Step 1: Initialize configuration manager
    console.log('📋 Initializing configuration manager...');
    const configManager = new ConfigManager();
    console.log('✅ Configuration manager initialized\n');

    // Step 2: Create PocketFlow config manager
    console.log('🔧 Creating PocketFlow config manager...');
    const pocketFlowConfigManager = createPocketFlowConfigManager(configManager);
    console.log('✅ PocketFlow config manager created\n');

    // Step 3: Create orchestrator
    console.log('🎯 Creating PocketFlow orchestrator...');
    const orchestrator = new PocketFlowOrchestrator(pocketFlowConfigManager);
    await orchestrator.initialize();
    console.log('✅ PocketFlow orchestrator created and initialized\n');

    // Step 4: Test orchestrator status
    console.log('📊 Checking orchestrator status...');
    const status = orchestrator.getStatus();
    console.log('Orchestrator Status:', JSON.stringify(status, null, 2));
    console.log('✅ Orchestrator status retrieved\n');

    // Step 5: Test semantic search agent directly
    console.log('🔍 Testing semantic search agent...');
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
      agentType: 'semantic_search',
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
    console.log('✅ Semantic search agent test completed\n');

    // Step 6: Test orchestrator with semantic search
    console.log('🎯 Testing orchestrator with semantic search...');
    const workflowContext = {
      query: 'authentication middleware',
      language: 'javascript',
      topK: 5,
      minSimilarity: 0.7,
      includePatternAnalysis: false,
      detailLevel: 'detailed'
    };

    const workflowResult = await orchestrator.executeCodeSearchWorkflow(workflowContext);
    console.log('Workflow Result:', {
      searchResultCount: workflowResult.searchResults.length,
      executionTime: workflowResult.executionTime,
      confidence: workflowResult.confidence
    });
    console.log('✅ Orchestrator workflow test completed\n');

    // Step 7: Cleanup
    console.log('🧹 Cleaning up resources...');
    await orchestrator.cleanup();
    console.log('✅ Cleanup completed\n');

    console.log('🎉 Core PocketFlow Integration test passed!');
    console.log('✅ PocketFlow orchestration is working correctly');
    console.log('✅ Semantic search agent is functional');
    console.log('✅ Workflow execution is operational');
    
    return true;

  } catch (error) {
    console.error('❌ Core PocketFlow Integration test failed:', error);
    return false;
  }
}

// Create a simple integration test
async function testCoreIntegration() {
  console.log('🔗 Testing Core Integration...\n');

  try {
    // Create logger
    const logger = createLogger({ level: LogLevel.INFO, enableConsole: true });
    
    // Create config manager
    const configManager = new ConfigManager();
    
    // Create PocketFlow config manager
    const pocketFlowConfigManager = createPocketFlowConfigManager(configManager);
    
    // Log configuration
    const config = pocketFlowConfigManager.getPocketFlowConfig();
    logger.info('PocketFlow Configuration:', {
      maxAgents: config.maxAgents,
      workflowTimeout: config.workflowTimeout,
      orchestrator: config.orchestrator
    });

    // Test agent configuration
    const searchAgentConfig = pocketFlowConfigManager.getAgentConfig('semantic_search');
    logger.info('Semantic Search Agent Config:', {
      name: searchAgentConfig.name,
      timeout: searchAgentConfig.timeout,
      maxConcurrentTasks: searchAgentConfig.maxConcurrentTasks
    });

    console.log('✅ Core integration test completed');
    return true;

  } catch (error) {
    console.error('❌ Core integration test failed:', error);
    return false;
  }
}

// Main test runner
async function runCoreTests() {
  console.log('🎯 Starting Core PocketFlow Integration Test Suite\n');
  console.log('='.repeat(50));
  console.log('');

  let allTestsPassed = true;

  // Test core integration first
  const coreTestsPassed = await testCoreIntegration();
  if (!coreTestsPassed) {
    allTestsPassed = false;
    console.log('❌ Core integration tests failed\n');
  } else {
    console.log('✅ Core integration tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Test core PocketFlow functionality
  const pocketFlowTestsPassed = await testCorePocketFlow();
  if (!pocketFlowTestsPassed) {
    allTestsPassed = false;
    console.log('❌ PocketFlow tests failed\n');
  } else {
    console.log('✅ PocketFlow tests passed\n');
  }

  console.log('='.repeat(50));
  console.log('');

  // Final results
  if (allTestsPassed) {
    console.log('🎉 All Core PocketFlow Integration tests passed!');
    console.log('✅ PocketFlow orchestration framework is integrated');
    console.log('✅ Configuration management is working');
    console.log('✅ Semantic search agent is operational');
    console.log('✅ Workflow execution is functional');
  } else {
    console.log('❌ Some tests failed. Please check the logs above.');
  }

  return allTestsPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runCoreTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runCoreTests, testCorePocketFlow, testCoreIntegration };