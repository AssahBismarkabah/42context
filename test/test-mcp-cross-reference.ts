#!/usr/bin/env tsx

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

/**
 * Test the cross-reference analyzer tools via MCP client
 */

/**
 * Test the cross-reference analyzer tools via MCP client
 */
async function testMcpCrossReferenceTools() {
  console.log('Testing Cross-Reference Analyzer Tools via MCP Client...');
  
  try {
    // Create MCP client transport that starts the server
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['--expose-gc', 'dist/src/main.js', 'server', '--transport', 'stdio']
    });

    // Create MCP client
    const client = new Client(
      {
        name: 'test-cross-reference-client',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );

    console.log('Connecting to MCP server...');
    await client.connect(transport);

    console.log(' Connected to MCP server');

    // Define schema for tool call response (used by all tool calls)
    const toolCallSchema = z.object({
      content: z.array(z.object({
        type: z.string(),
        text: z.string()
      }))
    });

    // Define schema for tools/list response
    const toolsListSchema = z.object({
      tools: z.array(z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.any()
      }))
    });
    
    // Test 1: List available tools
    console.log('\n Listing available tools...');
    
    const toolsResult = await client.request(
      { method: 'tools/list' },
      toolsListSchema
    );
    
    console.log('Available tools:', toolsResult.tools.map((t) => t.name).join(', '));

    // Check if cross-reference tools are available
    const crossRefTools = toolsResult.tools.filter((t) =>
      ['trace_method_calls', 'build_inheritance_tree', 'analyze_dependencies', 'find_implementations'].includes(t.name)
    );

    if (crossRefTools.length === 0) {
      console.log(' No cross-reference analyzer tools found');
      return;
    }

    console.log(` Found ${crossRefTools.length} cross-reference tools`);

    // First, let's test if the code_search tool can find our target class
    console.log('\n Testing code_search to find AuthenticationFlowRepresentation...');
    try {
      const searchResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'code_search',
            arguments: {
              query: 'AuthenticationFlowRepresentation',
              language: 'java',
              top_k: 3
            }
          }
        },
        toolCallSchema
      );

      console.log(' Code search result:');
      const result = JSON.parse(searchResult.content[0].text);
      console.log(`   - Found ${result.results.length} results`);
      if (result.results.length > 0) {
        console.log(`   - First result: ${result.results[0].name} in ${result.results[0].file_path}`);
      }
    } catch (error) {
      console.log(` Code search failed: ${(error as Error).message}`);
    }

    // Test 2: Test trace_method_calls tool
    console.log('\n1 Testing trace_method_calls tool...');
    try {
      // Define schema for tool call response
      const toolCallSchema = z.object({
        content: z.array(z.object({
          type: z.string(),
          text: z.string()
        }))
      });
      
      const traceResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'trace_method_calls',
            arguments: {
              method_name: 'getDescription',
              file_path: 'test-corpus/keycloak/core/src/main/java/org/keycloak/representations/idm/AuthenticationFlowRepresentation.java',
              max_depth: 2,
              direction: 'both'
            }
          }
        },
        toolCallSchema
      );

      console.log(' Trace method calls result:');
      const result = JSON.parse(traceResult.content[0].text);
      console.log(`   - Method: ${result.method_name}`);
      console.log(`   - Total methods: ${result.call_graph.total_methods}`);
      console.log(`   - Max depth: ${result.call_graph.max_depth}`);
      console.log(`   - Circular dependencies: ${result.call_graph.circular_dependencies}`);
    } catch (error) {
      console.log(` Trace method calls failed: ${(error as Error).message}`);
    }

    // Test 3: Test build_inheritance_tree tool
    console.log('\n Testing build_inheritance_tree tool...');
    try {
      const inheritanceResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'build_inheritance_tree',
            arguments: {
              class_name: 'AuthenticationFlowRepresentation',
              include_interfaces: true,
              include_abstract: true
            }
          }
        },
        toolCallSchema
      );

      console.log(' Build inheritance tree result:');
      const result = JSON.parse(inheritanceResult.content[0].text);
      console.log(`   - Class: ${result.class_name}`);
      console.log(`   - Tree depth: ${result.inheritance_tree.tree_depth}`);
      console.log(`   - Total classes: ${result.inheritance_tree.total_classes}`);
      console.log(`   - Interfaces: ${result.inheritance_tree.interfaces.length}`);
    } catch (error) {
      console.log(` Build inheritance tree failed: ${(error as Error).message}`);
    }

    // Test 4: Test analyze_dependencies tool
    console.log('\n Testing analyze_dependencies tool...');
    try {
      const dependencyResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'analyze_dependencies',
            arguments: {
              target: 'AuthenticationFlowRepresentation',
              dependency_types: ['import', 'inheritance', 'method-call'],
              scope: 'global'
            }
          }
        },
        toolCallSchema
      );

      console.log(' Analyze dependencies result:');
      const result = JSON.parse(dependencyResult.content[0].text);
      console.log(`   - Target: ${result.target}`);
      console.log(`   - Total nodes: ${result.dependency_analysis.total_nodes}`);
      console.log(`   - Total edges: ${result.dependency_analysis.total_edges}`);
      console.log(`   - Circular dependencies: ${result.dependency_analysis.circular_dependencies}`);
      console.log(`   - Average coupling: ${result.dependency_analysis.average_coupling.toFixed(2)}`);
      console.log(`   - Hotspots: ${result.dependency_analysis.hotspots.length}`);
    } catch (error) {
      console.log(` Analyze dependencies failed: ${(error as Error).message}`);
    }

    // Test 5: Test find_implementations tool
    console.log('\n4 Testing find_implementations tool...');
    try {
      const implementationResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'find_implementations',
            arguments: {
              interface_name: 'AuthenticationExecutionInfoRepresentation',
              include_subinterfaces: false
            }
          }
        },
        toolCallSchema
      );

      console.log(' Find implementations result:');
      const result = JSON.parse(implementationResult.content[0].text);
      console.log(`   - Interface: ${result.interface_name}`);
      console.log(`   - Found ${result.implementations.length} implementations:`);
      result.implementations.forEach((impl: any, index: number) => {
        console.log(`     ${index + 1}. ${impl.implementation_name} (${impl.file_path})`);
      });
    } catch (error) {
      console.log(` Find implementations failed: ${(error as Error).message}`);
    }

    // Disconnect from server
    console.log('\n Disconnecting from MCP server...');
    await client.close();
    
    console.log('\n All cross-reference analyzer tools tested successfully!');

  } catch (error) {
    console.error(' Error testing cross-reference analyzer tools:', error);
    console.error((error as Error).stack);
  }
}

// Run the test
if (require.main === module) {
  testMcpCrossReferenceTools().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { testMcpCrossReferenceTools };