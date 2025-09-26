
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { getGlobalLogger } from '../core/logger.js';
import { SemanticSearch } from '../ai/semantic-search.js';
import { EnhancedSemanticSearch, createLLMProvider } from '../ai/llm-provider.js';
import { ConfigManager } from '../core/config.js';
import { CodeParser } from '../analysis/code-parser.js';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { VersionManager } from './version.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { config } from 'dotenv';

// Load environment variables from .env file
config();


export interface MCPServerConfig {
  serverName: string;
  version: string;
  transportType: 'stdio' | 'http';
  port?: number;
  host?: string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
}

/**
 * MCP Server that exposes context engine tools to MCP clients
 */
export class MCPServer {
  private server: Server | null = null;
  private transport: StdioServerTransport | SSEServerTransport | null = null;
  private config: MCPServerConfig;
  private configManager: ConfigManager;
  private tools: Map<string, MCPToolDefinition> = new Map();
  private httpServer: any | null = null;
  private sseTransport: SSEServerTransport | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.configManager = new ConfigManager();
  }

  async start(): Promise<void> {
    try {
      const logger = getGlobalLogger();
      
      // Display banner
      this.displayBanner();
      
      logger.info(`Starting ${VersionManager.getBranding().displayName} MCP server: ${this.config.serverName} - v${VersionManager.getBranding().version} - DIAGNOSTIC BUILD`);

      // Create transport
      if (this.config.transportType === 'stdio') {
        this.transport = new StdioServerTransport();
      } else if (this.config.transportType === 'http') {
        // Create HTTP server for SSE transport
        await this.startHttpServer();
        return; // Early return as HTTP server setup is handled separately
      } else {
        throw new Error(`Unsupported transport type: ${this.config.transportType}`);
      }

      // Create and initialize server
      this.server = new Server(
        {
          name: this.config.serverName,
          version: this.config.version,
        },
        {
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: true, subscribe: true },
          },
        }
      );

      // Register tools
      this.registerTools();

      // Set up tool handlers with proper schema validation
      const listToolsSchema = z.object({
        method: z.literal('tools/list')
      });

      const callToolSchema = z.object({
        method: z.literal('tools/call'),
        params: z.object({
          name: z.string(),
          arguments: z.record(z.any()).optional()
        })
      });

      this.server.setRequestHandler(listToolsSchema, async () => {
        return {
          tools: Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }))
        };
      });

      this.server.setRequestHandler(callToolSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const tool = this.tools.get(name);
        
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }

        try {
          const result = await tool.handler(args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          logger.error(`Tool execution failed: ${name}`, error);
          throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await this.server.connect(this.transport);
      const branding = VersionManager.getBranding();
      logger.info(`${branding.displayName} MCP server v${branding.version} started successfully: ${this.config.serverName}`);

    } catch (error) {
      const logger = getGlobalLogger();
      logger.error(`Failed to start MCP server ${this.config.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Start HTTP server for SSE transport
   */
  private async startHttpServer(): Promise<void> {
    const logger = getGlobalLogger();
    const host = this.config.host || 'localhost';
    const port = this.config.port || 3000;

    this.httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        // Enable CORS for all origins
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // Handle SSE endpoint
        if (req.url === '/sse') {
          logger.info('New SSE connection request');
          
          // Create SSE transport
          this.sseTransport = new SSEServerTransport('/message', res);
          
          // Create and initialize server
          this.server = new Server(
            {
              name: this.config.serverName,
              version: this.config.version,
            },
            {
              capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true, subscribe: true },
              },
            }
          );

          // Register tools
          this.registerTools();

          // Set up tool handlers
          this.server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () => {
            return {
              tools: Array.from(this.tools.values()).map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              }))
            };
          });

          this.server.setRequestHandler(z.object({
            method: z.literal('tools/call'),
            params: z.object({
              name: z.string(),
              arguments: z.record(z.any()).optional()
            })
          }), async (request) => {
            const { name, arguments: args } = request.params;
            const tool = this.tools.get(name);
            
            if (!tool) {
              throw new Error(`Tool not found: ${name}`);
            }

            try {
              const result = await tool.handler(args);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                  }
                ]
              };
            } catch (error) {
              logger.error(`Tool execution failed: ${name}`, error);
              throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          });

          // Connect server to SSE transport
          await this.server.connect(this.sseTransport);
          
          const branding = VersionManager.getBranding();
          logger.info(`${branding.displayName} MCP server v${branding.version} started successfully with HTTP/SSE transport`);
          logger.info(`Server listening on http://${host}:${port}`);
          logger.info(`SSE endpoint: http://${host}:${port}/sse`);
          logger.info(`Message endpoint: http://${host}:${port}/message`);

        } else if (req.url === '/message' && req.method === 'POST') {
          // Handle incoming messages
          if (this.sseTransport) {
            await this.sseTransport.handlePostMessage(req, res);
          } else {
            res.writeHead(400);
            res.end('No active SSE connection');
          }
        } else {
          // Health check endpoint
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            server: this.config.serverName,
            version: this.config.version,
            transport: 'http/sse'
          }));
        }
      } catch (error) {
        logger.error('HTTP server error:', error);
        res.writeHead(500);
        res.end('Internal server error');
      }
    });

    // Start HTTP server
    this.httpServer.listen(port, host, () => {
      // Display banner for HTTP mode
      this.displayBanner();
      
      logger.info(`HTTP server started on ${host}:${port}`);
      logger.info(`MCP server endpoints:`);
      logger.info(`  SSE: http://${host}:${port}/sse`);
      logger.info(`  Messages: http://${host}:${port}/message`);
      logger.info(`  Health: http://${host}:${port}/`);
    });
  }


  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    if (this.sseTransport) {
      await this.sseTransport.close();
      this.sseTransport = null;
    }
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });
      this.httpServer = null;
    }
    
    const logger = getGlobalLogger();
    const branding = VersionManager.getBranding();
    logger.info(`${branding.displayName} MCP server stopped: ${this.config.serverName}`);
  }

  /**
   * Register MCP tools
   */
  private registerTools(): void {
    // Code search tool with optional LLM judgment enhancement
    this.tools.set('code_search', {
      name: 'code_search',
      description: 'Search for semantically similar code patterns in the codebase with optional LLM judgment for better relevance',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query describing what code patterns to find'
          },
          language: {
            type: 'string',
            description: 'Filter by programming language (optional)',
            enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'rust', 'go']
          },
          top_k: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            minimum: 1,
            maximum: 20
          },
          similarity_threshold: {
            type: 'number',
            description: 'Minimum similarity score (default: 0.2)',
            minimum: 0.0,
            maximum: 1.0
          },
          use_llm_judgment: {
            type: 'boolean',
            description: 'Use LLM judgment to improve result relevance (requires LLM provider configuration)',
            default: false
          },
          llm_provider: {
            type: 'string',
            description: 'LLM provider to use for judgment (openai, openrouter, custom)',
            enum: ['openai', 'openrouter', 'custom']
          },
          llm_model: {
            type: 'string',
            description: 'Specific model to use (e.g., gpt-3.5-turbo, gpt-4)'
          }
        },
        required: ['query']
      },
      handler: async (args) => {
        const semanticSearch = new SemanticSearch(this.configManager.getConfig().semanticSearch);
        await semanticSearch.initialize();
        
        // Check if LLM judgment is requested and configured
        if (args.use_llm_judgment) {
          try {
            // Get LLM configuration from environment or arguments
            const llmConfig: any = {
              provider: args.llm_provider || process.env.LLM_PROVIDER || 'openai',
              apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
              model: args.llm_model || process.env.LLM_MODEL || 'gpt-3.5-turbo'
            };
            
            // Only add baseURL if it's defined
            const baseURL = process.env.LLM_BASE_URL;
            if (baseURL) {
              llmConfig.baseURL = baseURL;
            }
            
            if (!llmConfig.apiKey) {
              throw new Error('LLM API key not found. Please set LLM_API_KEY or OPENAI_API_KEY environment variable.');
            }
            
            // Create LLM provider
            const llmProvider = createLLMProvider(llmConfig);
            
            // Create enhanced semantic search with LLM judgment
            const enhancedSearch = new EnhancedSemanticSearch(semanticSearch, llmProvider);
            
            // Perform enhanced search with LLM judgment
            const results = await enhancedSearch.searchWithJudgment(args.query, {
              topK: args.top_k || 5,
              language: args.language,
              minSimilarity: args.similarity_threshold || 0.2,
              useLLMJudgment: true
            });
            
            await semanticSearch.close();
            return results;
            
          } catch (llmError) {
            // Fallback to regular search if LLM fails
            const logger = getGlobalLogger();
            logger.warn('LLM judgment failed, falling back to regular search:', llmError);
            
            const results = await semanticSearch.search(args.query, {
              topK: args.top_k || 5,
              language: args.language,
              minSimilarity: args.similarity_threshold || 0.2
            });
            
            await semanticSearch.close();
            return {
              ...results,
              warning: 'LLM judgment failed, showing regular vector search results',
              llm_error: llmError instanceof Error ? llmError.message : String(llmError)
            };
          }
        } else {
          // Regular semantic search without LLM judgment
          const results = await semanticSearch.search(args.query, {
            topK: args.top_k || 5,
            language: args.language,
            minSimilarity: args.similarity_threshold || 0.2
          });
          
          await semanticSearch.close();
          return results;
        }
      }
    });

    // Context analysis tool
    this.tools.set('context_analysis', {
      name: 'context_analysis',
      description: 'Analyze code structure, complexity, and dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to analyze'
          },
          analysis_type: {
            type: 'string',
            description: 'Type of analysis to perform',
            enum: ['complexity', 'dependencies', 'patterns', 'security', 'general'],
            default: 'general'
          },
          include_related_files: {
            type: 'boolean',
            description: 'Include analysis of related files',
            default: false
          }
        },
        required: ['file_path']
      },
      handler: async (args) => {
        const parser = new CodeParser();
        const content = readFileSync(args.file_path, 'utf-8');
        const language = parser.detectLanguage(args.file_path);
        
        if (!language) {
          throw new Error(`Unsupported file type: ${args.file_path}`);
        }
        
        const chunks = await parser.parseFile(args.file_path, content);
        
        return {
          file_path: args.file_path,
          language: language,
          analysis_type: args.analysis_type,
          code_chunks: chunks,
          total_chunks: chunks.length,
          complexity_analysis: this.analyzeComplexity(chunks),
          dependency_analysis: this.analyzeDependencies(chunks)
        };
      }
    });

    // Find related code tool
    this.tools.set('find_related_code', {
      name: 'find_related_code',
      description: 'Find code related to the current context',
      inputSchema: {
        type: 'object',
        properties: {
          current_file: {
            type: 'string',
            description: 'Current file path'
          },
          context_window: {
            type: 'number',
            description: 'Lines of context around cursor',
            default: 10
          },
          relationship_type: {
            type: 'string',
            description: 'Type of relationship to find',
            enum: ['similar', 'dependent', 'referenced'],
            default: 'similar'
          }
        },
        required: ['current_file']
      },
      handler: async (args) => {
        const semanticSearch = new SemanticSearch(this.configManager.getConfig().semanticSearch);
        await semanticSearch.initialize();
        
        // Use filename-based search with better query generation
        const fileName = args.current_file.split('/').pop() || '';
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        
        // Better query generation: handle camelCase and PascalCase properly
        let query = baseName
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Handle consecutive caps
          .replace(/([a-z])([A-Z])/g, '$1 $2')       // Handle camelCase
          .toLowerCase()
          .trim();
        
        // If the query is too fragmented (like "j o s e parser"), try a simpler approach
        if (query.split(' ').length > 4) {
          query = baseName.toLowerCase();
        }
        
        const results = await semanticSearch.search(query, {
          topK: 15,
          minSimilarity: 0.2  // Add minimum similarity threshold like code_search
        });
        
        await semanticSearch.close();
        
        // Return the full results object exactly like code_search does
        return results;
      }
    });

    // Find implementations tool - REVIVED with vector-based approach
    this.tools.set('find_implementations', {
      name: 'find_implementations',
      description: 'Find all implementations of an interface or abstract class using semantic search',
      inputSchema: {
        type: 'object',
        properties: {
          interface_name: {
            type: 'string',
            description: 'Name of the interface to find implementations for'
          },
          include_subinterfaces: {
            type: 'boolean',
            description: 'Include implementations of sub-interfaces',
            default: false
          }
        },
        required: ['interface_name']
      },
      handler: async (args) => {
        const semanticSearch = new SemanticSearch(this.configManager.getConfig().semanticSearch);
        await semanticSearch.initialize();
        
        // Search for implementations using semantic similarity
        // Look for classes that implement the interface
        const searchQueries = [
          `implements ${args.interface_name}`,
          `extends ${args.interface_name}`,
          `class.*${args.interface_name}`,
          `${args.interface_name} implementation`
        ];
        
        const allResults = [];
        const seenFiles = new Set<string>();
        
        for (const query of searchQueries) {
          const results = await semanticSearch.search(query, {
            topK: 10,
            minSimilarity: 0.3
          });
          
          // Filter and deduplicate results
          for (const result of results.results) {
            if (!seenFiles.has(result.filePath) &&
                (result.content.includes('implements') ||
                 result.content.includes('extends') ||
                 result.type === 'class' ||
                 result.type === 'function')) {
              allResults.push(result);
              seenFiles.add(result.filePath);
            }
          }
        }
        
        await semanticSearch.close();
        
        return {
          interface_name: args.interface_name,
          implementations: allResults.slice(0, 15).map(impl => ({
            implementation_name: impl.id.split('_').pop() || 'Unknown',
            file_path: impl.filePath,
            package: impl.filePath.includes('src/main/java/') ?
              impl.filePath.split('src/main/java/')[1].replace(/\//g, '.').replace('.java', '') :
              impl.filePath,
            is_abstract: impl.content.includes('abstract'),
            method_count: impl.content.split('(').length - 1,
            similarity: impl.similarity
          }))
        };
      }
    });

    // REMOVED: Documentation generation tool - not functional, returns empty results
    // this.tools.set('generate_documentation', {
    //   name: 'generate_documentation',
    //   description: 'Generate documentation for code snippets',
    //   inputSchema: {
    //     type: 'object',
    //     properties: {
    //       code_snippet: {
    //         type: 'string',
    //         description: 'Code to generate documentation for'
    //       },
    //       documentation_style: {
    //         type: 'string',
    //         description: 'Style of documentation',
    //         enum: ['inline', 'separate', 'markdown'],
    //         default: 'inline'
    //       },
    //       include_examples: {
    //         type: 'boolean',
    //         description: 'Include usage examples',
    //         default: true
    //       }
    //     },
    //     required: ['code_snippet']
    //   },
    //   handler: async (args) => {
    //     const parser = new CodeParser();
    //
    //     // Parse the code snippet to understand its structure
    //     const tempFile = '/tmp/temp_code_snippet.js';
    //     writeFileSync(tempFile, args.code_snippet);
    //
    //     try {
    //       const chunks = await parser.parseFile(tempFile, args.code_snippet);
    //
    //       return {
    //         code_snippet: args.code_snippet,
    //         documentation_style: args.documentation_style,
    //         parsed_chunks: chunks.length,
    //         documentation: this.generateDocumentation(chunks)
    //       };
    //     } finally {
    //       // Clean up temp file
    //       if (existsSync(tempFile)) {
    //         unlinkSync(tempFile);
    //       }
    //     }
    //   }
    // });

    // REMOVED: Cross-reference analysis tools - they don't work with current indexing
    // this.registerCrossReferenceTools();
  }

  /**
   * Register cross-reference analysis tools - DISABLED due to indexing issues
  //  */
  // private registerCrossReferenceTools(): void {
  //   // Cross-reference tools are disabled because they rely on stale indexes
  //   // that don't sync with the vector store. Use semantic search instead.
  //   return;
  //   // Trace method calls tool
  //   this.tools.set('trace_method_calls', {
  //     name: 'trace_method_calls',
  //     description: 'Trace method calls across the codebase to build call graphs and identify dependencies',
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         method_name: {
  //           type: 'string',
  //           description: 'Name of the method to trace'
  //         },
  //         class_name: {
  //           type: 'string',
  //           description: 'Name of the class containing the method (optional)'
  //         },
  //         file_path: {
  //           type: 'string',
  //           description: 'Path to the file containing the method (optional)'
  //         },
  //         max_depth: {
  //           type: 'number',
  //           description: 'Maximum depth to trace (default: 10)',
  //           minimum: 1,
  //           maximum: 50,
  //           default: 10
  //         },
  //         direction: {
  //           type: 'string',
  //           description: 'Direction of call tracing',
  //           enum: ['callers', 'callees', 'both'],
  //           default: 'both'
  //         }
  //       },
  //       required: ['method_name']
  //     },
  //     handler: async (args) => {
  //       const config = this.configManager.getConfig();
  //       const codeStorage = new CodeStorage({
  //         persistToDisk: config.codeStorage.persistToDisk,
  //         storagePath: config.codeStorage.storagePath,
  //         maxMemorySize: config.codeStorage.maxMemorySize
  //       });
  //       const vectorStore = new ChromaVectorStore(
  //         config.vectorStore.collectionName,
  //         config.vectorStore.host,
  //         config.vectorStore.port,
  //         config.vectorStore.authToken
  //       );
  //       const embeddingService = new EmbeddingService({
  //         modelName: config.embedding.modelName,
  //         batchSize: config.embedding.batchSize,
  //         maxSequenceLength: 512,
  //         cacheSize: 10000,
  //         device: 'cpu',
  //         useOptimizer: true
  //       });
  //       const analyzer = new CrossReferenceAnalyzerImpl(codeStorage, vectorStore, embeddingService);
        
  //       await vectorStore.initialize();
  //       await embeddingService.initialize();
        
  //       try {
  //         const result = await analyzer.traceMethodCalls({
  //           methodName: args.method_name,
  //           className: args.class_name,
  //           filePath: args.file_path,
  //           maxDepth: args.max_depth,
  //           direction: args.direction
  //         });
          
  //         return {
  //           method_name: args.method_name,
  //           call_graph: {
  //             root: result.root,
  //             total_methods: result.metadata.totalMethods,
  //             max_depth: result.metadata.maxDepth,
  //             circular_dependencies: result.metadata.circularDependencies,
  //             entry_points: result.entryPoints,
  //             termination_points: result.terminationPoints,
  //             edges: result.edges
  //           }
  //         };
  //       } finally {
  //         await vectorStore.close();
  //         // No cleanup method available in EmbeddingService
  //       }
  //     }
  //   });

  //   // Build inheritance tree tool
  //   this.tools.set('build_inheritance_tree', {
  //     name: 'build_inheritance_tree',
  //     description: 'Build inheritance tree for a class to understand class hierarchies and relationships',
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         class_name: {
  //           type: 'string',
  //           description: 'Name of the class to analyze'
  //         },
  //         include_interfaces: {
  //           type: 'boolean',
  //           description: 'Include interfaces in the inheritance tree',
  //           default: true
  //         },
  //         include_abstract: {
  //           type: 'boolean',
  //           description: 'Include abstract classes in the inheritance tree',
  //           default: true
  //         }
  //       },
  //       required: ['class_name']
  //     },
  //     handler: async (args) => {
  //       const config = this.configManager.getConfig();
  //       const codeStorage = new CodeStorage({
  //         persistToDisk: config.codeStorage.persistToDisk,
  //         storagePath: config.codeStorage.storagePath,
  //         maxMemorySize: config.codeStorage.maxMemorySize
  //       });
  //       const vectorStore = new ChromaVectorStore(
  //         config.vectorStore.collectionName,
  //         config.vectorStore.host,
  //         config.vectorStore.port,
  //         config.vectorStore.authToken
  //       );
  //       const embeddingService = new EmbeddingService({
  //         modelName: config.embedding.modelName,
  //         batchSize: config.embedding.batchSize,
  //         maxSequenceLength: 512,
  //         cacheSize: 10000,
  //         device: 'cpu',
  //         useOptimizer: true
  //       });
  //       const analyzer = new CrossReferenceAnalyzerImpl(codeStorage, vectorStore, embeddingService);
        
  //       await vectorStore.initialize();
  //       await embeddingService.initialize();
        
  //       try {
  //         const result = await analyzer.buildInheritanceTree({
  //           className: args.class_name,
  //           includeInterfaces: args.include_interfaces,
  //           includeAbstract: args.include_abstract
  //         });
          
  //         return {
  //           class_name: args.class_name,
  //           inheritance_tree: {
  //             root_class: result.root.name,
  //             tree_depth: result.depth,
  //             total_classes: result.nodes.size,
  //             interfaces: result.interfaces,
  //             abstract_classes: result.abstractClasses,
  //             concrete_classes: result.concreteClasses
  //           }
  //         };
  //       } finally {
  //         await vectorStore.close();
  //         // No cleanup method available in EmbeddingService
  //       }
  //     }
  //   });

  //   // Analyze dependencies tool
  //   this.tools.set('analyze_dependencies', {
  //     name: 'analyze_dependencies',
  //     description: 'Analyze dependencies between components to identify coupling and architectural issues',
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         target: {
  //           type: 'string',
  //           description: 'Target component to analyze (class name, package, or file)'
  //         },
  //         dependency_types: {
  //           type: 'array',
  //           description: 'Types of dependencies to analyze',
  //           items: {
  //             type: 'string',
  //             enum: ['import', 'inheritance', 'composition', 'method-call']
  //           },
  //           default: ['import', 'inheritance', 'method-call']
  //         },
  //         scope: {
  //           type: 'string',
  //           description: 'Scope of analysis',
  //           enum: ['file', 'package', 'global'],
  //           default: 'global'
  //         }
  //       },
  //       required: ['target']
  //     },
  //     handler: async (args) => {
  //       const config = this.configManager.getConfig();
  //       const codeStorage = new CodeStorage({
  //         persistToDisk: config.codeStorage.persistToDisk,
  //         storagePath: config.codeStorage.storagePath,
  //         maxMemorySize: config.codeStorage.maxMemorySize
  //       });
  //       const vectorStore = new ChromaVectorStore(
  //         config.vectorStore.collectionName,
  //         config.vectorStore.host,
  //         config.vectorStore.port,
  //         config.vectorStore.authToken
  //       );
  //       const embeddingService = new EmbeddingService({
  //         modelName: config.embedding.modelName,
  //         batchSize: config.embedding.batchSize,
  //         maxSequenceLength: 512,
  //         cacheSize: 10000,
  //         device: 'cpu',
  //         useOptimizer: true
  //       });
  //       const analyzer = new CrossReferenceAnalyzerImpl(codeStorage, vectorStore, embeddingService);
        
  //       await vectorStore.initialize();
  //       await embeddingService.initialize();
        
  //       try {
  //         const result = await analyzer.analyzeDependencies({
  //           target: args.target,
  //           dependencyTypes: args.dependency_types,
  //           scope: args.scope
  //         });
          
  //         return {
  //           target: args.target,
  //           dependency_analysis: {
  //             total_nodes: result.metrics.totalNodes,
  //             total_edges: result.metrics.totalEdges,
  //             circular_dependencies: result.metrics.circularDependencies,
  //             average_coupling: result.metrics.averageCoupling,
  //             stability_index: result.metrics.stabilityIndex,
  //             hotspots: result.hotspots.map(hotspot => ({
  //               component: hotspot.nodeId,
  //               issue_type: hotspot.type,
  //               score: hotspot.score,
  //               recommendations: hotspot.recommendations
  //             }))
  //           }
  //         };
  //       } finally {
  //         await vectorStore.close();
  //         // No cleanup method available in EmbeddingService
  //       }
  //     }
  //   });

  //   // Find implementations tool
  //   this.tools.set('find_implementations', {
  //     name: 'find_implementations',
  //     description: 'Find all implementations of an interface or abstract class',
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         interface_name: {
  //           type: 'string',
  //           description: 'Name of the interface to find implementations for'
  //         },
  //         include_subinterfaces: {
  //           type: 'boolean',
  //           description: 'Include implementations of sub-interfaces',
  //           default: false
  //         }
  //       },
  //       required: ['interface_name']
  //     },
  //     handler: async (args) => {
  //       const config = this.configManager.getConfig();
  //       const codeStorage = new CodeStorage({
  //         persistToDisk: config.codeStorage.persistToDisk,
  //         storagePath: config.codeStorage.storagePath,
  //         maxMemorySize: config.codeStorage.maxMemorySize
  //       });
  //       const vectorStore = new ChromaVectorStore(
  //         config.vectorStore.collectionName,
  //         config.vectorStore.host,
  //         config.vectorStore.port,
  //         config.vectorStore.authToken
  //       );
  //       const embeddingService = new EmbeddingService({
  //         modelName: config.embedding.modelName,
  //         batchSize: config.embedding.batchSize,
  //         maxSequenceLength: 512,
  //         cacheSize: 10000,
  //         device: 'cpu',
  //         useOptimizer: true
  //       });
  //       const analyzer = new CrossReferenceAnalyzerImpl(codeStorage, vectorStore, embeddingService);
        
  //       await vectorStore.initialize();
  //       await embeddingService.initialize();
        
  //       try {
  //         const implementations = await analyzer.findImplementations({
  //           interfaceName: args.interface_name,
  //           includeSubinterfaces: args.include_subinterfaces
  //         });
          
  //         return {
  //           interface_name: args.interface_name,
  //           implementations: implementations.map(impl => ({
  //             implementation_name: impl.implementationName,
  //             file_path: impl.filePath,
  //             package: impl.package,
  //             is_abstract: impl.isAbstract,
  //             method_count: impl.methods.length
  //           }))
  //         };
  //       } finally {
  //         await vectorStore.close();
  //         // No cleanup method available in EmbeddingService
  //       }
  //     }
  //   });
  // }

  /**
   * Analyze code complexity
   */
  private analyzeComplexity(chunks: any[]): any {
    const complexity = {
      total_functions: chunks.filter(c => c.type === 'function').length,
      total_classes: chunks.filter(c => c.type === 'class').length,
      average_function_length: 0,
      max_function_length: 0,
      cyclomatic_complexity: 'medium'
    };

    const functions = chunks.filter(c => c.type === 'function');
    if (functions.length > 0) {
      const lengths = functions.map(f => f.endLine - f.startLine);
      complexity.average_function_length = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      complexity.max_function_length = Math.max(...lengths);
    }

    return complexity;
  }

  /**
   * Analyze dependencies
   */
  private analyzeDependencies(chunks: any[]): any {
    const allDependencies = new Set<string>();
    chunks.forEach(chunk => {
      if (chunk.dependencies) {
        chunk.dependencies.forEach((dep: string) => allDependencies.add(dep));
      }
    });

    return {
      total_dependencies: allDependencies.size,
      dependencies: Array.from(allDependencies),
      external_dependencies: Array.from(allDependencies).filter(dep =>
        !dep.startsWith('./') && !dep.startsWith('../') && !dep.startsWith('/')
      )
    };
  }

  /**
   * Generate documentation - REMOVED: Not used anymore
   */
  // private generateDocumentation(chunks: any[]): any {
  //   return chunks.map(chunk => ({
  //     name: chunk.name,
  //     type: chunk.type,
  //     documentation: `Generated documentation for ${chunk.type} ${chunk.name}`,
  //     parameters: chunk.signature ? this.extractParameters(chunk.signature) : [],
  //     return_type: chunk.signature ? this.extractReturnType(chunk.signature) : 'unknown'
  //   }));
  // }

  /**
   * Extract parameters from signature - REMOVED: Not used anymore
   */
  // private extractParameters(signature: string): string[] {
  //   const match = signature.match(/\((.*?)\)/);
  //   return match ? match[1].split(',').map(p => p.trim()).filter(p => p) : [];
  // }

  /**
   * Extract return type from signature - REMOVED: Not used anymore
   */
  // private extractReturnType(signature: string): string {
  //   const match = signature.match(/:\s*([^\{]+)/);
  //   return match ? match[1].trim() : 'unknown';
  // }
  /**
   * Display the banner from docs/banner.txt
   */
  private displayBanner(): void {
    try {
      const bannerContent = readFileSync('docs/banner.txt', 'utf-8');
      console.log('\n' + bannerContent + '\n');
    } catch (error) {
      // If banner file doesn't exist, just skip it silently
      const logger = getGlobalLogger();
      logger.debug('Banner file not found, skipping display');
    }
  }
}

export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();

  async addServer(config: MCPServerConfig): Promise<MCPServer> {
    const server = new MCPServer(config);
    await server.start();
    this.servers.set(config.serverName, server);
    return server;
  }

  async removeServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (server) {
      await server.stop();
      this.servers.delete(serverName);
    }
  }

  getServer(serverName: string): MCPServer | undefined {
    return this.servers.get(serverName);
  }

  listServers(): string[] {
    return Array.from(this.servers.keys());
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map(server =>
      server.stop()
    );
    await Promise.all(stopPromises);
    this.servers.clear();
  }
}

export default MCPServer;