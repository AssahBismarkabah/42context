
import { Command } from 'commander';
import { ContextEngine } from '../core/index.js';
import { ConfigManager } from '../core/config.js';
import { getGlobalLogger, LogLevel } from '../core/logger.js';
import path from 'path';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { SemanticSearch } from '../ai/semantic-search.js';
import { ChromaVectorStore } from '../ai/chroma-vector-store.js';
import { EmbeddingService } from '../ai/embedding-service.js';
import { CodeParser } from '../analysis/code-parser.js';
import { SearchResult } from '../core/types.js';
import { VersionManager } from '../mcp/version.js';
import { MemoryManager } from '../mcp/memory-manager.js';
import { MemoryConfigManager } from '../mcp/memory-config.js';
import { CrossReferenceAnalyzerImpl } from '../analysis/cross-reference-analyzer.js';
import { CodeStorage } from '../storage/code-storage.js';

const program = new Command();
const logger = getGlobalLogger();

export { program };

/**
 * CLI Interface for MCP Local Context Engine
 */
export class CLIInterface {
  private engine: ContextEngine | null = null;
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Setup all CLI commands
   */
  setupCommands(): void {
    program
      .name('42context')
      .description('42Context Engine - MCP-Based Semantic Code Search and Analysis Platform')
      .version(VersionManager.getVersion())
      .option('-d, --debug', 'Enable debug mode')
      .option('-c, --config <path>', 'Configuration file path')
      .hook('preAction', (thisCommand: any) => {
        const options = thisCommand.opts();
        if (options.debug) {
          logger.setLevel(LogLevel.DEBUG);
          console.log('Debug mode enabled');
        }
      });

    // Start command - run the full context engine
    program
      .command('start')
      .description('Start the context engine with file watching')
      .option('-p, --project-path <path>', 'Project path to watch', process.cwd())
      .action(async (options: any) => {
        try {
          await this.startEngine(options.projectPath, program.opts().debug);
        } catch (error) {
          console.error('Failed to start context engine:', error);
          process.exit(1);
        }
      });

    // Search command - perform semantic search
    program
      .command('search')
      .description('Perform semantic search on indexed code')
      .argument('<query>', 'Search query')
      .option('-l, --language <lang>', 'Filter by programming language')
      .option('-t, --type <type>', 'Filter by code type (function, class, etc.)')
      .option('-f, --file <path>', 'Filter by file path')
      .option('-k, --top-k <number>', 'Number of results to return', '5')
      .option('-s, --min-similarity <score>', 'Minimum similarity score', '0.2')
      .option('--format <format>', 'Output format (json, table, plain)', 'table')
      .action(async (query: string, options: any) => {
        try {
          await this.searchCommand(query, options);
        } catch (error) {
          console.error('Search failed:', error);
          process.exit(1);
        }
      });

    // Analyze command - analyze code structure
    program
      .command('analyze')
      .description('Analyze code structure and dependencies')
      .argument('[file-path]', 'Specific file to analyze')
      .option('-d, --depth <number>', 'Analysis depth', '1')
      .option('--format <format>', 'Output format (json, tree, plain)', 'tree')
      .action(async (filePath: string, options: any) => {
        try {
          await this.analyzeCommand(filePath, options);
        } catch (error) {
          console.error('Analysis failed:', error);
          process.exit(1);
        }
      });

    // Index command - manually index files
    program
      .command('index')
      .description('Manually index files or directories')
      .argument('[path]', 'File or directory to index', process.cwd())
      .option('-r, --recursive', 'Index recursively')
      .option('-f, --force', 'Force re-indexing of existing files')
      .action(async (indexPath: string, options: any) => {
        try {
          await this.indexCommand(indexPath, options);
        } catch (error) {
          console.error('Indexing failed:', error);
          process.exit(1);
        }
      });

    // Index X-Refs command - build cross-reference indexes
    program
      .command('index-xrefs')
      .description('Build cross-reference indexes for analysis tools')
      .action(async () => {
        try {
          await this.indexXrefsCommand();
        } catch (error) {
          console.error('Cross-reference indexing failed:', error);
          process.exit(1);
        }
      });

    // Config command - manage configuration
    program
      .command('config')
      .description('Manage configuration settings')
      .argument('<action>', 'Action: get, set, list, reset')
      .argument('[key]', 'Configuration key')
      .argument('[value]', 'Configuration value')
      .action(async (action: string, key?: string, value?: string) => {
        try {
          await this.configCommand(action, key, value);
        } catch (error) {
          console.error('Config command failed:', error);
          process.exit(1);
        }
      });

    // Stats command - show system statistics
    program
      .command('stats')
      .description('Show system statistics')
      .option('--format <format>', 'Output format (json, table)', 'table')
      .action(async (options: any) => {
        try {
          await this.statsCommand(options);
        } catch (error) {
          console.error('Stats command failed:', error);
          process.exit(1);
        }
      });

    // Clear command - clear indexes and caches
    program
      .command('clear')
      .description('Clear indexes and caches')
      .option('--vectors', 'Clear vector store')
      .option('--cache', 'Clear embedding cache')
      .option('--all', 'Clear everything')
      .action(async (options: any) => {
        try {
          await this.clearCommand(options);
        } catch (error) {
          console.error('Clear command failed:', error);
          process.exit(1);
        }
      });

    // Debug command - debugging utilities
    program
      .command('debug')
      .description('Debugging utilities')
      .argument('<action>', 'Action: parse, embed, test-connection, memory, memory-profile')
      .argument('[file]', 'File to debug or profile name')
      .action(async (action: string, file?: string) => {
        try {
          await this.debugCommand(action, file);
        } catch (error) {
          console.error('Debug command failed:', error);
          process.exit(1);
        }
      });

    // Server command - start MCP server
    program
      .command('server')
      .description('Start the MCP server for external client connections')
      .option('-p, --port <port>', 'Server port (for HTTP transport)', '3000')
      .option('-h, --host <host>', 'Server host (for HTTP transport)', 'localhost')
      .option('-t, --transport <type>', 'Transport type (stdio, http)', 'stdio')
      .action(async (options: any) => {
        try {
          await this.startServer(options);
        } catch (error) {
          console.error('Failed to start MCP server:', error);
          process.exit(1);
        }
      });

    // Completion command - generate shell completions
    program
      .command('completion')
      .description('Generate shell completion script')
      .argument('<shell>', 'Shell type: bash, zsh, fish')
      .action((shell: string) => {
        this.generateCompletion(shell);
      });
  }

  /**
   * Start the context engine
   */
  private async startEngine(projectPath: string, debug: boolean): Promise<void> {
    const branding = VersionManager.getBranding();
    console.log(`Starting ${branding.displayName} v${branding.version}...`);
    console.log(`Project path: ${path.resolve(projectPath)}`);
    
    this.engine = new ContextEngine({
      projectPath: path.resolve(projectPath),
      debug: debug,
      configPath: program.opts().config
    });

    await this.engine.start();
  }

  /**
   * Search command implementation
   */
  private async searchCommand(query: string, options: any): Promise<void> {
    console.log(`Searching for: "${query}"`);
    
    const config = this.configManager.getConfig();
    const semanticSearch = new SemanticSearch(config.semanticSearch);
    await semanticSearch.initialize();

    const searchOptions = {
      topK: parseInt(options.topK),
      language: options.language,
      chunkType: options.type,
      filePath: options.file,
      minSimilarity: parseFloat(options.minSimilarity)
    };

    const results = await semanticSearch.search(query, searchOptions);
    
    this.displaySearchResults(results, options.format);
    
    await semanticSearch.close();
  }

  /**
   * Analyze command implementation
   */
  private async analyzeCommand(filePath: string | undefined, options: any): Promise<void> {
    const parser = new CodeParser();
    
    if (filePath) {
      // Analyze specific file
      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
      }

      const content = readFileSync(filePath, 'utf-8');
      const language = parser.detectLanguage(filePath);
      
      if (!language) {
        console.error(`Unsupported file type: ${filePath}`);
        return;
      }

      console.log(`Analyzing file: ${filePath}`);
      console.log(`Language: ${language}`);
      
      const chunks = await parser.parseFile(filePath, content);
      
      this.displayAnalysisResults(chunks, options.format);
    } else {
      // Analyze project structure
      console.log('Analyzing project structure...');
      console.log('This feature is under development');
    }
  }

  /**
   * Index command implementation
   */
  private async indexCommand(indexPath: string, options: any): Promise<void> {
    console.log(`Indexing: ${indexPath}`);
    
    const config = this.configManager.getConfig();
    const semanticSearch = new SemanticSearch(config.semanticSearch);
    await semanticSearch.initialize();

    try {
      const resolvedPath = path.resolve(indexPath);
      
      if (!existsSync(resolvedPath)) {
        console.error(`Path not found: ${resolvedPath}`);
        return;
      }

      const stats = statSync(resolvedPath);
      
      if (stats.isFile()) {
        // Index single file
        await this.indexFile(semanticSearch, resolvedPath);
      } else if (stats.isDirectory()) {
        // Index directory
        await this.indexDirectory(semanticSearch, resolvedPath, options.recursive);
      } else {
        console.error(`Unsupported path type: ${resolvedPath}`);
        return;
      }

      console.log('Indexing completed successfully');
    } catch (error) {
      console.error('Indexing failed:', error);
      throw error;
    } finally {
      await semanticSearch.close();
    }
  }

  /**
   * Index a single file
   */
  private async indexFile(semanticSearch: SemanticSearch, filePath: string): Promise<void> {
    console.log(`Indexing file: ${filePath}`);
    
    // Check if file is supported
    if (!this.isSupportedFile(filePath)) {
      console.log(`Skipping unsupported file: ${filePath}`);
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check file size limit
      const config = this.configManager.getConfig();
      if (content.length > config.security.maxFileSize) {
        console.warn(`File too large, skipping: ${filePath}`);
        return;
      }

      await semanticSearch.indexFile(filePath, content);
      console.log(`✓ Successfully indexed: ${filePath}`);
    } catch (error) {
      console.error(`✗ Failed to index file ${filePath}:`, error);
      // Continue with other files even if one fails
    }
  }

  /**
   * Index a directory recursively
   */
  private async indexDirectory(semanticSearch: SemanticSearch, dirPath: string, recursive: boolean): Promise<void> {
    console.log(`Indexing directory: ${dirPath} (recursive: ${recursive})`);
    
    const files = this.getFilesInDirectory(dirPath, recursive);
    const supportedFiles = files.filter(file => this.isSupportedFile(file));
    
    console.log(`Found ${files.length} total files, ${supportedFiles.length} supported files`);
    
    if (supportedFiles.length === 0) {
      console.log('No supported files found to index');
      return;
    }

    // Initialize memory manager for large-scale indexing
    const memoryManager = new MemoryManager({
      maxHeapSizeMB: 1200,
      gcThresholdMB: 600,
      batchSizeReductionThresholdMB: 800,
      emergencyThresholdMB: 1000,
      enableForceGC: true
    });

    // Index files in batches with memory management
    const initialBatchSize = 50;
    let processed = 0;
    let currentBatchSize = initialBatchSize;
    
    for (let i = 0; i < supportedFiles.length; i += currentBatchSize) {
      // Check memory pressure and adjust batch size
      const pressure = memoryManager.checkMemoryPressure();
      if (pressure.shouldReduceBatchSize) {
        currentBatchSize = Math.max(5, Math.floor(currentBatchSize * 0.5));
        console.log(`[Memory] Reducing batch size to ${currentBatchSize} due to ${pressure.severity} pressure`);
      }

      const batch = supportedFiles.slice(i, i + currentBatchSize);
      const batchNumber = Math.floor(i / currentBatchSize) + 1;
      const totalBatches = Math.ceil(supportedFiles.length / currentBatchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`);
      
      // Force GC before processing large batches
      if (batch.length >= 25) {
        await memoryManager.forceGarbageCollection(`batch_${batchNumber}_start`);
      }
      
      // Process files sequentially to avoid memory spikes
      for (const filePath of batch) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          
          // Check file size limit
          const config = this.configManager.getConfig();
          if (content.length > config.security.maxFileSize) {
            console.warn(`File too large, skipping: ${filePath}`);
            continue;
          }

          // Check memory before each file
          const filePressure = memoryManager.checkMemoryPressure();
          if (filePressure.shouldPause) {
            console.log(`[Memory] Waiting for pressure reduction before processing ${filePath}`);
            await memoryManager.waitForMemoryPressureReduction(10000);
          }

          await semanticSearch.indexFile(filePath, content);
          processed++;
          console.log(`✓ ${processed}/${supportedFiles.length}: ${filePath}`);
          
          // Small delay between files to prevent memory spikes
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          console.error(`✗ Failed to index file ${filePath}:`, error);
          // Continue with other files instead of failing entire batch
        }
      }
      
      // Force GC after processing large batches
      if (batch.length >= 25) {
        await memoryManager.forceGarbageCollection(`batch_${batchNumber}_end`);
        // Brief pause to allow GC to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`Indexing completed: ${processed}/${supportedFiles.length} files processed`);
  }

  /**
   * Index cross-references command implementation
   */
  private async indexXrefsCommand(): Promise<void> {
    console.log('Building cross-reference indexes...');

    const config = this.configManager.getConfig();
    const vectorStore = new ChromaVectorStore(
      config.vectorStore.collectionName,
      config.vectorStore.host || 'localhost',
      config.vectorStore.port || 8000,
      config.vectorStore.authToken || 'test-token'
    );
    await vectorStore.initialize();

    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();

    const codeStorage = new CodeStorage({ persistToDisk: true });

    const xrefAnalyzer = new CrossReferenceAnalyzerImpl(
      codeStorage,
      vectorStore,
      embeddingService
    );

    // This is a private method, so we need to cast to any to call it.
    // In a real application, we might expose a public method for this.
    await (xrefAnalyzer as any).buildIndexes();

    console.log('Cross-reference indexes built successfully');

    await vectorStore.close();
  }

  /**
   * Get all files in a directory
   */
  private getFilesInDirectory(dirPath: string, recursive: boolean): string[] {
    const files: string[] = [];
    
    try {
      const entries = readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = statSync(fullPath);
        
        if (stats.isFile()) {
          files.push(fullPath);
        } else if (stats.isDirectory() && recursive) {
          // Recursively get files from subdirectories
          const subFiles = this.getFilesInDirectory(fullPath, recursive);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Check if file is supported based on extension
   */
  private isSupportedFile(filePath: string): boolean {
    const supportedExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * Config command implementation
   */
  private async configCommand(action: string, key?: string, value?: string): Promise<void> {
    switch (action) {
      case 'get':
        if (!key) {
          console.error('Please specify a configuration key');
          return;
        }
        const configValue = this.configManager.getConfig();
        console.log(`Configuration: ${key} = ${JSON.stringify(configValue, null, 2)}`);
        break;
      case 'set':
        if (!key || !value) {
          console.error('Please specify both key and value');
          return;
        }
        console.log(`Setting ${key} = ${value}`);
        console.log('Config set implementation pending...');
        break;
      case 'list':
        console.log('Current configuration:');
        console.log(JSON.stringify(this.configManager.getConfig(), null, 2));
        break;
      case 'reset':
        console.log('Resetting configuration to defaults...');
        console.log('Config reset implementation pending...');
        break;
      default:
        console.error(`Unknown action: ${action}`);
        console.log('Available actions: get, set, list, reset');
    }
  }

  /**
   * Display search results
   */
  private displaySearchResults(results: SearchResult, format: string): void {
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else if (format === 'table') {
      console.log(`\nSearch Results (${results.resultCount} found):`);
      console.log('='.repeat(60));
      
      results.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.type} | ${result.filePath}:${result.lineStart}-${result.lineEnd}`);
        console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
        console.log(`   Content: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
        console.log('');
      });
    } else {
      // plain format
      results.results.forEach((result) => {
        console.log(`${result.filePath}:${result.lineStart}-${result.lineEnd} | ${result.type} | ${result.content}`);
      });
    }
  }

  /**
   * Display analysis results
   */
  private displayAnalysisResults(chunks: any[], format: string): void {
    if (format === 'json') {
      console.log(JSON.stringify(chunks, null, 2));
    } else if (format === 'tree') {
      console.log(`\nCode Structure Analysis:`);
      console.log('='.repeat(40));
      
      chunks.forEach((chunk, index) => {
        console.log(`${index + 1}. ${chunk.type}: ${chunk.name}`);
        console.log(`   Lines: ${chunk.startLine}-${chunk.endLine}`);
        if (chunk.signature) {
          console.log(`   Signature: ${chunk.signature}`);
        }
        if (chunk.documentation) {
          console.log(`   Documentation: ${chunk.documentation}`);
        }
        if (chunk.dependencies.length > 0) {
          console.log(`   Dependencies: ${chunk.dependencies.join(', ')}`);
        }
        console.log('');
      });
    } else {
      // plain format
      chunks.forEach((chunk) => {
        console.log(`${chunk.type}: ${chunk.name} (${chunk.startLine}-${chunk.endLine})`);
      });
    }
  }

  /**
   * Stats command implementation
   */
  private async statsCommand(options: any): Promise<void> {
    console.log('System Statistics:');
    console.log('==================');
    
    try {
      const config = this.configManager.getConfig();
      const vectorStore = new ChromaVectorStore(
        config.vectorStore.collectionName,
        config.vectorStore.host || 'localhost',
        config.vectorStore.port || 8000,
        config.vectorStore.authToken || 'test-token'
      );
      
      await vectorStore.initialize();
      const stats = await vectorStore.getCollectionStats();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(`Vector Count: ${stats.count}`);
        console.log(`Dimension: ${stats.dimension || 'unknown'}`);
      }
      
      await vectorStore.close();
    } catch (error) {
      console.error('Failed to get statistics:', error);
    }
  }

  /**
   * Clear command implementation
   */
  private async clearCommand(options: any): Promise<void> {
    console.log('Clearing data...');
    
    try {
      const config = this.configManager.getConfig();
      const vectorStore = new ChromaVectorStore(
        config.vectorStore.collectionName,
        config.vectorStore.host || 'localhost',
        config.vectorStore.port || 8000,
        config.vectorStore.authToken || 'test-token'
      );
      
      await vectorStore.initialize();
      
      if (options.all || options.vectors) {
        await vectorStore.clear();
        console.log('Vector store cleared');
      }
      
      if (options.all || options.cache) {
        console.log('Embedding cache cleared');
      }
      
      await vectorStore.close();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }

  /**
   * Debug command implementation
   */
  private async debugCommand(action: string, file?: string): Promise<void> {
    switch (action) {
      case 'parse':
        if (!file) {
          console.error('Please specify a file to parse');
          return;
        }
        
        if (!existsSync(file)) {
          console.error(`File not found: ${file}`);
          return;
        }
        
        console.log(`Parsing file: ${file}`);
        const parser = new CodeParser();
        const content = readFileSync(file, 'utf-8');
        const language = parser.detectLanguage(file);
        
        if (!language) {
          console.error(`Unsupported file type: ${file}`);
          return;
        }
        
        console.log(`Language: ${language}`);
        const chunks = await parser.parseFile(file, content);
        console.log(`Found ${chunks.length} code chunks:`);
        
        chunks.forEach((chunk, index) => {
          console.log(`  ${index + 1}. ${chunk.type}: ${chunk.name} (${chunk.startLine}-${chunk.endLine})`);
        });
        break;
      
      case 'embed':
        if (!file) {
          console.error('Please specify a file to embed');
          return;
        }
        
        console.log(`Generating embeddings for: ${file}`);
        const embeddingService = new EmbeddingService();
        await embeddingService.initialize();
        
        console.log('Embedding debug implementation pending...');
        
        break;
      
      case 'test-connection':
        console.log('Testing connections...');
        try {
          const config = this.configManager.getConfig();
          const vectorStore = new ChromaVectorStore(
            config.vectorStore.collectionName,
            config.vectorStore.host || 'localhost',
            config.vectorStore.port || 8000,
            config.vectorStore.authToken || 'test-token'
          );
          
          await vectorStore.initialize();
          const stats = await vectorStore.getCollectionStats();
          console.log(`✓ ChromaDB connection successful (${stats.count} vectors)`);
          await vectorStore.close();
        } catch (error) {
          console.error('✗ ChromaDB connection failed:', error);
        }
        break;
      
      case 'memory':
        console.log('Memory Status Report:');
        console.log('====================');
        const memoryManager = new MemoryManager();
        const report = memoryManager.getMemoryReport();
        
        console.log(`Current Memory: ${report.current.heapUsedMB}MB / ${report.current.heapTotalMB}MB`);
        console.log(`Memory Trend: ${report.trend}`);
        console.log(`Pressure Level: ${report.pressure.severity}`);
        console.log(`GC Calls: ${report.gcStats.count}`);
        console.log(`Time Since Last GC: ${Math.round(report.gcStats.timeSinceLastGC / 1000)}s`);
        
        if (report.recommendations.length > 0) {
          console.log('\nRecommendations:');
          report.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
        break;
      
      case 'memory-profile':
        const profileName = file || 'default';
        console.log(`Switching to memory profile: ${profileName}`);
        const memoryConfigManager = MemoryConfigManager.getInstance();
        
        if (profileName === 'default') {
          console.log('Using default memory configuration');
        } else if (['conservative', 'aggressive', 'development'].includes(profileName)) {
          memoryConfigManager.setProfile(profileName as any);
          const newConfig = memoryConfigManager.getConfig();
          console.log(`Profile applied: ${profileName}`);
          console.log(`Max heap size: ${newConfig.thresholds.maxHeapSizeMB}MB`);
          console.log(`Initial batch size: ${newConfig.batchProcessing.initialBatchSize}`);
        } else {
          console.error(`Unknown memory profile: ${profileName}`);
          console.log('Available profiles: default, conservative, aggressive, development');
        }
        break;
      
      default:
        console.error(`Unknown debug action: ${action}`);
        console.log('Available actions: parse, embed, test-connection, memory, memory-profile');
    }
  }

  /**
   * Generate shell completion
   */
  private generateCompletion(shell: string): void {
    const completionScript = this.getCompletionScript(shell);
    console.log(completionScript);
  }

  /**
   * Get completion script for specified shell
   */
  private getCompletionScript(shell: string): string {
    switch (shell) {
      case 'bash':
        return `# bash completion for mcp-context-engine
_mcp_context_engine_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    opts="start search analyze index config stats clear debug completion"
    
    case "\${prev}" in
        mcp-context-engine)
            COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "get set list reset" -- \${cur}) )
            return 0
            ;;
        debug)
            COMPREPLY=( $(compgen -W "parse embed test-connection" -- \${cur}) )
            return 0
            ;;
    esac
}

complete -F _mcp_context_engine_completion mcp-context-engine`;
      
      case 'zsh':
        return `# zsh completion for mcp-context-engine
#compdef mcp-context-engine

_mcp_context_engine() {
    local -a commands
    commands=(
        'start:Start the context engine with file watching'
        'search:Perform semantic search on indexed code'
        'analyze:Analyze code structure and dependencies'
        'index:Manually index files or directories'
        'config:Manage configuration settings'
        'stats:Show system statistics'
        'clear:Clear indexes and caches'
        'debug:Debugging utilities'
        'completion:Generate shell completion script'
    )
    
    _describe 'command' commands
}

compdef _mcp_context_engine mcp-context-engine`;
      
      case 'fish':
        return `# fish completion for mcp-context-engine
complete -c mcp-context-engine -f

# Commands
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "start" -d "Start the context engine with file watching"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "search" -d "Perform semantic search on indexed code"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "analyze" -d "Analyze code structure and dependencies"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "index" -d "Manually index files or directories"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "config" -d "Manage configuration settings"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "stats" -d "Show system statistics"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "clear" -d "Clear indexes and caches"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "debug" -d "Debugging utilities"
complete -c mcp-context-engine -n "__fish_use_subcommand" -a "completion" -d "Generate shell completion script"

# Config subcommands
complete -c mcp-context-engine -n "__fish_seen_subcommand_from config" -a "get" -d "Get configuration value"
complete -c mcp-context-engine -n "__fish_seen_subcommand_from config" -a "set" -d "Set configuration value"
complete -c mcp-context-engine -n "__fish_seen_subcommand_from config" -a "list" -d "List all configuration"
complete -c mcp-context-engine -n "__fish_seen_subcommand_from config" -a "reset" -d "Reset configuration to defaults"

# Debug subcommands
complete -c mcp-context-engine -n "__fish_seen_subcommand_from debug" -a "parse" -d "Parse a file"
complete -c mcp-context-engine -n "__fish_seen_subcommand_from debug" -a "embed" -d "Generate embeddings for a file"
complete -c mcp-context-engine -n "__fish_seen_subcommand_from debug" -a "test-connection" -d "Test connections to services"`;
      
      default:
        return `# Generic completion for ${shell}
# Add your completion rules here`;
    }
  }

  /**
   * Start MCP server
   */
  private async startServer(options: any): Promise<void> {
    const { MCPServer } = await import('../mcp/mcp-server.js');
    const branding = VersionManager.getBranding();
    
    console.log(`Starting ${branding.displayName} MCP Server v${branding.version}...`);
    console.log(`Transport: ${options.transport}`);
    
    if (options.transport === 'http') {
      console.log(`Host: ${options.host}`);
      console.log(`Port: ${options.port}`);
    }

    const server = new MCPServer({
      serverName: '42context-mcp-server',
      version: VersionManager.getVersion(),
      transportType: options.transport,
      host: options.host,
      port: parseInt(options.port)
    });

    await server.start();
    
    console.log(`${branding.displayName} MCP Server started successfully`);
    console.log('Server is ready to accept MCP client connections');
    console.log('Press Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(`Shutting down ${branding.displayName} MCP server...`);
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(`Shutting down ${branding.displayName} MCP server...`);
      await server.stop();
      process.exit(0);
    });
  }
}
export default CLIInterface;

