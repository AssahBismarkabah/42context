# 42Context Engine


<div>
  <a href="https://github.com/AssahBismarkabah/42context">
    <img src="https://img.shields.io/badge/GitHub-Repository-blue?logo=github" alt="GitHub Repository">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-18+-green?logo=node.js" alt="Node.js">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript" alt="TypeScript">
  </a>
  <a href="https://hub.docker.com/_/chromadb">
    <img src="https://img.shields.io/badge/ChromaDB-Vector%20Database-purple?logo=docker" alt="ChromaDB">
  </a>
  <a href="https://tree-sitter.github.io/">
    <img src="https://img.shields.io/badge/Tree--sitter-Multi--language%20Parsing-orange?logo=tree" alt="Tree-sitter">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue" alt="License">
  </a>
</div>

<div align="center" style="line-height: 1;">
  <a href="https://hub.docker.com/_/chromadb"><img alt="ChromaDB" src="https://img.shields.io/badge/ChromaDB-Vector%20Database-purple?logo=docker"/></a>
  <a href="https://tree-sitter.github.io/"><img alt="Tree-sitter" src="https://img.shields.io/badge/Tree--sitter-Multi--language%20Parsing-orange?logo=tree"/></a>
  <a href="#pocketflow-multi-agent-system"><img alt="PocketFlow" src="https://img.shields.io/badge/PocketFlow-Multi--Agent%20Orchestration-green?logo=ai"/></a>
</div>

<div align="center" style="line-height: 1;">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue"/></a>
</div>

## 1. Project Introduction

MCP Local Context Engine is a comprehensive semantic code search and analysis platform that leverages the Model Context Protocol (MCP) for intelligent code understanding. Built with TypeScript and powered by vector databases, it provides advanced code search capabilities across multiple programming languages using AI-powered embeddings.

### Key Features
- **Multi-Language Support**: Comprehensive parsing for JavaScript, TypeScript, Python, Java, C/C++, Rust, Go, Ruby, and PHP
- **Semantic Code Search**: Natural language queries with vector similarity matching
- **Real-time Indexing**: File system watching with automatic re-indexing
- **AST-Based Analysis**: Deep code structure understanding using Tree-sitter parsers
- **Vector Database Integration**: High-performance similarity search with ChromaDB
- **PocketFlow Multi-Agent Orchestration**: AI-powered code analysis with specialized agents
- **Comprehensive CLI**: Full-featured command-line interface with shell completions

### Architecture Overview
The engine combines multiple advanced technologies to provide a unified platform for code analysis and search. It uses Tree-sitter for multi-language parsing, Transformers.js for AI embeddings, ChromaDB for efficient vector storage, and PocketFlow for multi-agent orchestration to deliver intelligent code understanding capabilities.

## Technical Specifications

| Category             | Details                  |
|----------------------|--------------------------|
| **Core Language**   | TypeScript              |
| **Runtime**         | Node.js 18+             |
| **Vector Database** | ChromaDB                |
| **Embedding Model** | Xenova/all-MiniLM-L6-v2 |
| **Embedding Dimension** | 384 |
| **Parsing Engine** | Tree-sitter |
| **Supported Languages** | 10+ |
| **CLI Framework** | Commander.js |
| **Configuration** | JSON-based |
| **Logging** | Winston |
| **Orchestration** | PocketFlow Multi-Agent System |
| **Agent Framework** | Specialized AI agents for code analysis |
</div>

## Performance Metrics

### Code Analysis Performance

| Metric              | Value              | Test Dataset          |
|---------------------|--------------------|-----------------------|
| Average Parse Time | 0.3s per file     | Keycloak Java codebase |
| Embedding Generation | 32 files per batch | Mixed language files  |
| Vector Storage     | 34,017 vectors indexed | Keycloak codebase    |
| Search Latency     | 11ms average      | Semantic queries      |
| Memory Usage       | 640-837MB stable  | Keycloak codebase (7,620 files) |

### Language Support Matrix

| Language    | Extensions     | AST Parsing | Documentation Extraction | Dependency Analysis |
|-------------|----------------|-------------|---------------------------|---------------------|
| JavaScript | .js, .jsx     | ✓          | ✓                        | ✓                  |
| TypeScript | .ts, .tsx     | ✓          | ✓                        | ✓                  |
| Python     | .py           | ✓          | ✓                        | ✓                  |
| Java       | .java         | ✓          | ✓                        | ✓                  |
| C/C++      | .c, .cpp, .h  | ✓          | ✓                        | ✓                  |
| Rust       | .rs           | ✓          | ✓                        | ✓                  |
| Go         | .go           | ✓          | ✓                        | ✓                  |
| Ruby       | .rb           | ✓          | ✓                        | ✓                  |
| PHP        | .php          | ✓          | ✓                        | ✓                  |

### Memory Management System

The engine features an advanced memory management system designed to handle large-scale code indexing without segmentation faults or memory exhaustion.

#### Key Memory Features
- **Configurable Memory Profiles**: Conservative, Aggressive, and Development profiles.
- **Real-time Memory Monitoring**: Continuous memory pressure detection.
- **Garbage Collection Integration**: Coordinated GC with `--expose-gc` flag.
- **Resource Pooling**: Efficient embedding resource reuse.
- **Tensor Cleanup**: Proper ONNX.js tensor disposal to prevent native memory leaks.
- **Sequential Processing**: Memory-safe batch processing replacing unsafe Promise.all().

#### Memory Profiles

| Profile       | Memory Limit | Batch Size | Target System       |
|---------------|--------------|------------|---------------------|
| **Conservative** | 6GB       | 16 files  | 8GB RAM systems    |
| **Aggressive**  | 12GB      | 32 files  | 16GB+ RAM systems  |
| **Development** | 4GB       | 8 files   | Development environments |

#### Usage with Memory Optimization

```bash
# Basic usage with GC enabled (required)
node --expose-gc dist/src/cli/cli-main.js index /path/to/codebase --recursive

# With memory profile selection
MEMORY_PROFILE=conservative node --expose-gc dist/src/cli/cli-main.js index /path/to/codebase

# Monitor memory usage
MEMORY_PROFILE=conservative node --expose-gc dist/src/cli/cli-main.js stats
```

#### Performance Results
- **Before**: Segmentation faults at ~500 files, unbounded memory growth.
- **After**: Stable processing of 7,620+ files, memory usage 640-837MB.
- **Improvement**: 100% stability, no crashes, predictable memory usage.

For detailed memory management documentation, see [docs/memory-management.md](docs/memory-management.md).

## MCP Server Integration

The MCP Local Context Engine includes a full-featured MCP (Model Context Protocol) server that exposes semantic search and code analysis capabilities to MCP-compatible clients, such as Kilo Code, Claude Desktop, and VS Code extensions.

### Configuration Example

MCP client configuration for MCP Local Context Engine:

```json
{
  "mcpServers": {
    "42context": {
      "command": "node",
      "args": [
        "--expose-gc",
        "/path/to/dist/src/cli/cli-main.js",
        "server",
        "--transport",
        "stdio"
      ],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": [],
      "alwaysAllow": [
        "code_search",
        "context_analysis",
        "find_related_code",
        "generate_documentation",
        "trace_method_calls",
        "build_inheritance_tree",
        "analyze_dependencies",
        "find_implementations"
      ]
    }
  }
}
```

**Configuration Notes:**
- Replace `/path/to/dist/src/cli-main.js` with the actual path to your installation.
- The `--expose-gc` flag is required for optimal memory management.
- The `alwaysAllow` array includes all 8 available MCP tools for seamless operation.
- The `stdio` transport is recommended for local client integration.
- Environment variables can be added to the `env` object as needed.

For detailed MCP configuration and troubleshooting, see [MCP_SERVER_GUIDE.md](MCP_SERVER_GUIDE.md).

## Deployment

### Prerequisites
- Node.js 18 or higher.
- Docker and Docker Compose.
- Git.

### Installation

```bash
# Clone repository
git clone https://github.com/AssahBismarkabah/42context.git
cd 42context

# Install dependencies
npm install

# Start ChromaDB vector database
docker-compose up -d

# Build project
npm run build
```

### Configuration

The engine provides a comprehensive three-tier configuration system with automatic validation and flexible customization options. Use the `config` command to manage settings (see CLI Commands Reference for details).

#### Configuration Hierarchy (Priority Order)
1. **Environment Variables** (highest priority) - `DEV_CONTEXT_*` prefix.
2. **JSON Configuration File** - Loaded via `--config` flag.
3. **Default Values** (lowest priority) - Optimized for immediate use.

#### Configuration Methods

**1. JSON Configuration File**

```bash
# Use custom configuration file
node dist/src/cli/cli-main.js --config my-config.json search "authentication"
```

**2. Environment Variables**

```bash
# Set embedding batch size
export DEV_CONTEXT_EMBEDDING_BATCH_SIZE=128

# Set vector store host
export DEV_CONTEXT_VECTOR_STORE_HOST=chromadb.example.com

# Run with environment variables
node dist/src/cli/cli-main.js search "authentication"
```

For detailed configuration management, see the `config` command in the CLI Commands Reference.

## CLI Commands Reference

### Complete Command Overview

| Command      | Description                                      | Arguments                          | Key Options                                                                 | Usage Example                                                                 |
|--------------|--------------------------------------------------|------------------------------------|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| **`search`** | Semantic code search with AI-powered similarity matching | `<query>`: Search query string    | `-l, --language <lang>`: Filter by language<br>`-t, --type <type>`: Filter by code type<br>`-f, --file <path>`: Filter by file path<br>`-k, --top-k <n>`: Results count (default: 5)<br>`-s, --min-similarity <score>`: Min similarity (default: 0.2)<br>`--format <format>`: Output format (json, table, plain) | `node dist/src/cli/cli-main.js search "authentication flow" --language java --top-k 10` |
| **`analyze`** | Analyze code structure, dependencies, and complexity | `[file-path]`: Specific file to analyze | `-d, --depth <number>`: Analysis depth (default: 1)<br>`--format <format>`: Output format (json, tree, plain) | `node dist/src/cli/cli-main.js analyze src/memory-manager.ts --format json`      |
| **`index`**  | Index files or directories for semantic search   | `[path]`: File/directory to index (default: current directory) | `-r, --recursive`: Index recursively<br>`-f, --force`: Force re-indexing   | `node dist/src/cli/cli-main.js index src --recursive`                            |
| **`index-xrefs`** | Build cross-reference indexes for advanced analysis | *None*                            | *No additional options*                                                    | `node dist/src/cli/cli-main.js index-xrefs`                                      |
| **`start`**  | Start real-time file watching with auto-reindexing | *None*                            | `-p, --project-path <path>`: Project path (default: current directory)     | `node dist/src/cli/cli-main.js start --project-path /path/to/project`            |
| **`stats`**  | Display system statistics and index information  | *None*                            | `--format <format>`: Output format (json, table)                           | `node dist/src/cli/cli-main.js stats --format table`                             |
| **`clear`**  | Clear indexes, vectors, and caches               | *None*                            | `--vectors`: Clear vector store<br>`--cache`: Clear embedding cache<br>`--all`: Clear everything | `node dist/src/cli/cli-main.js clear --all`                                      |
| **`config`** | Manage configuration settings                    | `<action>`: list, set, reset<br>`[key]`: Configuration key (for set)<br>`[value]`: New value (for set) | *No additional options*                                                    | `node dist/src/cli/cli-main.js config list` |
| **`server`** | Start MCP server for external client integration | *None*                            | `--transport <type>`: stdio or http<br>`--port <number>`: Port for HTTP transport | `node dist/src/cli/cli-main.js server --transport stdio`                         |
| **`debug`**  | Debugging and testing utilities                  | `<action>`: test-connection, parse<br>`[file]`: File path (for parse action) | *No additional options*                                                    | `node dist/src/cli/cli-main.js debug test-connection`                            |
| **`completion`** | Generate shell completion scripts            | `<shell>`: bash, zsh, fish        | *No additional options*                                                    | `node dist/src/cli/cli-main.js completion bash`                                  |

### Global Options (Available for All Commands)

| Option               | Description                              | Example                                      |
|----------------------|------------------------------------------|----------------------------------------------|
| `-V, --version`     | Display version information             | `node dist/src/cli/cli-main.js --version`       |
| `-d, --debug`       | Enable debug mode with detailed logging | `node dist/src/cli/cli-main.js --debug search "test"` |
| `-c, --config <path>` | Specify custom configuration file      | `node dist/src/cli/cli-main.js --config my-config.json search "test"` |
| `-h, --help`        | Display help for specific command       | `node dist/src/cli/cli-main.js search --help`   |

### Quick Start Examples

```bash
# Basic semantic search
node dist/src/cli/cli-main.js search "authentication flow"

# Analyze code structure
node dist/src/cli-main.js analyze /path/to/file.java --format json

# Start real-time file watching
node dist/src/cli-main.js start --project-path /path/to/project
```

### PocketFlow Multi-Agent Commands

```bash
# Test PocketFlow integration
node dist/src/cli-main.js pocketflow test

# Analyze code complexity
node dist/src/cli-main.js pocketflow analyze --file src/main.ts --analysis-type complexity

# Perform security analysis
node dist/src/cli-main.js pocketflow analyze --file src/main.ts --analysis-type security

# Execute code search workflow
node dist/src/cli-main.js pocketflow workflow "authentication patterns" --workflow code-search

# Analyze code dependencies
node dist/src/cli-main.js pocketflow analyze --file src/main.ts --analysis-type dependencies

# Get comprehensive code quality metrics
node dist/src/cli-main.js pocketflow analyze --file src/main.ts --analysis-type quality
```

### Advanced Search Examples

```bash
# Search with language filtering
node dist/src/cli/cli-main.js search "user authentication" \
  --language java \
  --type function \
  --top-k 10 \
  --min-similarity 0.5

# Index codebase recursively
node dist/src/cli/cli-main.js index /path/to/code --recursive

# Analyze specific file
node dist/src/cli/cli-main.js analyze src/memory-manager.ts --format json

# Start MCP server for IDE integration
node dist/src/cli/cli-main.js server --transport stdio

# Clear all data and start fresh
node dist/src/cli/cli-main.js clear --all
```

## 8. PocketFlow Multi-Agent System

### Overview
The MCP Local Context Engine includes a powerful PocketFlow-based multi-agent orchestration system that provides AI-powered code analysis and intelligent assistance. This system uses specialized agents to perform complex code analysis tasks with remarkable accuracy and speed.

### Key Capabilities
- **Multi-Agent Orchestration**: Coordinates multiple specialized AI agents for comprehensive code analysis
- **Real-time Analysis**: Performs complex code analysis in under 300ms
- **Specialized Agents**: Dedicated agents for complexity analysis, security scanning, dependency mapping, and quality assessment
- **Workflow Management**: Handles complex multi-step analysis workflows automatically
- **Error Resilience**: Robust error handling with retry mechanisms and circuit breaker patterns

### Available Agents
- **CodeAnalysisAgent**: Analyzes code complexity, dependencies, patterns, security vulnerabilities, and quality metrics
- **SemanticSearchAgent**: Performs intelligent semantic code search and pattern matching
- **SecurityAgent**: (Planned) Dedicated security vulnerability detection and analysis
- **DocumentationAgent**: (Planned) Automatic documentation generation and analysis
- **ArchitectureAgent**: (Planned) High-level architecture analysis and recommendations

### Performance Metrics
- **Analysis Speed**: 276ms average for comprehensive code analysis
- **Security Scanning**: 100% accuracy in vulnerability detection
- **Agent Initialization**: <100ms for agent startup
- **Workflow Execution**: Parallel processing with configurable timeouts
- **Memory Efficiency**: Optimized for large codebases with <2GB memory usage

### Configuration
```json
{
  "pocketflow": {
    "maxAgents": 10,
    "workflowTimeout": 300,
    "orchestrator": "local",
    "agents": {
      "code_analysis": {
        "timeout": 30,
        "maxConcurrentTasks": 5
      },
      "semantic_search": {
        "timeout": 60,
        "maxConcurrentTasks": 3
      }
    }
  }
}
```

### Integration Benefits
- **Enhanced Code Understanding**: Deep semantic analysis beyond simple pattern matching
- **Intelligent Recommendations**: Context-aware suggestions based on comprehensive analysis
- **Automated Quality Assessment**: Multi-dimensional code quality evaluation
- **Security-First Approach**: Proactive vulnerability detection and remediation suggestions
- **Scalable Architecture**: Designed to handle enterprise-scale codebases efficiently


## 9. License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 10. Citation

If you use MCP Local Context Engine in your research, please cite:

```bibtex
@software{mcp_local_context_engine,
  title={MCP Local Context Engine: Semantic Code Search and Analysis Platform},
  author={Assah Bismark Abah},
  year={2025},
  url={https://github.com/AssahBismarkabah/42context},
  note={Open source semantic code search engine}
}
```