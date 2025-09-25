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

42Context Local Context Engine is a comprehensive code search and analysis tool that leverages MCP for intelligent code understanding. 
it provides advanced AI-powered code search capabilities across codebase.

Key features include natural language queries with vector similarity matching, real-time file system watching with automatic re-indexing, deep AST-based code structure analysis, high-performance similarity search, and full MCP server integration with stdio and HTTP transports. It also incorporates advanced memory management to handle large codebases (7,620+ files) without segmentation faults, along with a comprehensive CLI supporting shell completions.

## Technical Specifications

| Category             | Details                  |
|----------------------|--------------------------|
| **Core Language**   | TypeScript              |
| **Runtime**         | Node.js 18+             |
| **Vector Database** | ChromaDB                |
| **Embedding Model** | Xenova/all-MiniLM-L6-v2 |
| **Embedding Dimension** | 384                 |
| **Parsing Engine**  | Tree-sitter             |
| **Supported Languages** | 10+                 |
| **CLI Framework**   | Commander.js            |
| **Configuration**   | JSON-based              |
| **Logging**         | Winston                 |

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
node --expose-gc $(which 42context) index /path/to/codebase --recursive

# With memory profile selection
MEMORY_PROFILE=conservative node --expose-gc $(which 42context) index /path/to/codebase

# Monitor memory usage
MEMORY_PROFILE=conservative node --expose-gc $(which 42context) stats
```

#### Performance Results
- **Before**: Segmentation faults at ~500 files, unbounded memory growth.
- **After**: Stable processing of 7,620+ files, memory usage 640-837MB.
- **Improvement**: 100% stability, no crashes, predictable memory usage.

For detailed memory management documentation, see [docs/memory-management.md](docs/memory-management.md).

## MCP Server Integration

The MCP Local Context Engine includes a full-featured MCP (Model Context Protocol) server that exposes semantic search and code analysis capabilities to MCP-compatible clients, such as Kilo Code, Claude Desktop, and VS Code extensions.

### Quick Start - Start Server First

**Before configuring MCP clients, you must start the 42Context server:**

```bash
# Start the MCP server (required first step)
42context server --transport stdio

# The server will run and wait for MCP client connections
# Keep this terminal running - do not close it
```

**Then configure your MCP client** (Claude Desktop, VS Code, etc.) with the configuration below.

### Configuration Example

MCP client configuration for MCP Local Context Engine:

```json
{
  "mcpServers": {
    "42context": {
      "command": "42context",
      "args": [
        "server",
        "--transport",
        "stdio"
      ],
      "env": {
        "NODE_ENV": "production",
        "LLM_API_KEY": "YOUR_LLM_API_KEY",
        "LLM_BASE_URL": "YOUR_LLM_BASE_URL",
        "LLM_PROVIDER": "YOUR_LLM_PROVIDER",
        "LLM_MODEL": "YOUR_LLM_MODEL"
      },
      "disabled": false,
      "autoApprove": [],
      "alwaysAllow": [
        "code_search",
        "context_analysis",
        "find_related_code",
        "find_implementations"
      ]
    }
  }
}
```

**Configuration Notes:**
- **Start the server first**: Run `42context server --transport stdio` before configuring clients
- **LLM Configuration**: Add `LLM_API_KEY` and optional `LLM_BASE_URL` to enable DSPy-style LLM judgment
- The `42context` command should be available in your PATH after global installation
- The `alwaysAllow` array includes all 4 working MCP tools for seamless operation
- The `stdio` transport is recommended for local client integration
- Environment variables can be added to the `env` object as needed
- For development installations, use the full path to `dist/src/cli/cli-main.js`

### Setup Workflow

1. **Install 42Context**: `npm install -g @aaswe/42context-engine`
2. **Start components**: `42context start-components --detached`
3. **Start MCP server**: `42context server --transport stdio`
4. **Configure MCP client**: Add the JSON configuration to your client
5. **Test connection**: Your MCP client should now have access to 42Context tools

For detailed MCP configuration and troubleshooting, see [MCP_SERVER_GUIDE.md](MCP_SERVER_GUIDE.md).

## Deployment

### Prerequisites
- Node.js 18 or higher.
- Docker and Docker Compose.
- Git.

### Quick Installation (NPM)

```bash
# Install globally from NPM
npm install -g @aaswe/42context-engine

# Start components (ChromaDB + Admin interface)
42context start-components --detached

# Ready to use!
42context search "authentication flow" --use-llm-judgment
```

### Development Installation

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
42context --config my-config.json search "authentication"
```

**2. Environment Variables**

```bash
# Set embedding batch size
export DEV_CONTEXT_EMBEDDING_BATCH_SIZE=128

# Set vector store host
export DEV_CONTEXT_VECTOR_STORE_HOST=chromadb.example.com

# Run with environment variables
42context search "authentication"
```

For detailed configuration management, see the `config` command in the CLI Commands Reference.

## CLI Commands Reference

### Complete Command Overview

| Command      | Description                                      | Arguments                          | Key Options                                                                 | Usage Example                                                                 |
|--------------|--------------------------------------------------|------------------------------------|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| **`start-components`** | Start required components (ChromaDB + Admin) | *None* | `-d, --detached`: Run in background<br>`--build`: Build images before starting | `42context start-components --detached` |
| **`search`** | Semantic code search with AI-powered similarity matching | `<query>`: Search query string    | `-l, --language <lang>`: Filter by language<br>`-t, --type <type>`: Filter by code type<br>`-f, --file <path>`: Filter by file path<br>`-k, --top-k <n>`: Results count (default: 5)<br>`-s, --min-similarity <score>`: Min similarity (default: 0.2)<br>`--format <format>`: Output format (json, table, plain)<br>`--use-llm-judgment`: Enable DSPy-style LLM filtering for disambiguation<br>`--llm-provider <provider>`: LLM provider (openai, anthropic, custom)<br>`--llm-model <model>`: Specific LLM model to use | `42context search "authentication flow" --language java --top-k 10 --use-llm-judgment --llm-provider custom --llm-model gpt-3.5-turbo` |
| **`analyze`** | Analyze code structure, dependencies, and complexity | `[file-path]`: Specific file to analyze | `-d, --depth <number>`: Analysis depth (default: 1)<br>`--format <format>`: Output format (json, tree, plain) | `42context analyze src/memory-manager.ts --format json`      |
| **`index`**  | Index files or directories for semantic search   | `[path]`: File/directory to index (default: current directory) | `-r, --recursive`: Index recursively<br>`-f, --force`: Force re-indexing   | `42context index src --recursive`                            |
| **`index-xrefs`** | Build cross-reference indexes for advanced analysis | *None*                            | *No additional options*                                                    | `42context index-xrefs`                                      |
| **`start`**  | Start real-time file watching with auto-reindexing | *None*                            | `-p, --project-path <path>`: Project path (default: current directory)     | `42context start --project-path /path/to/project`            |
| **`stats`**  | Display system statistics and index information  | *None*                            | `--format <format>`: Output format (json, table)                           | `42context stats --format table`                             |
| **`clear`**  | Clear indexes, vectors, and caches               | *None*                            | `--vectors`: Clear vector store<br>`--cache`: Clear embedding cache<br>`--all`: Clear everything | `42context clear --all`                                      |
| **`config`** | Manage configuration settings                    | `<action>`: list, set, reset<br>`[key]`: Configuration key (for set)<br>`[value]`: New value (for set) | *No additional options*                                                    | `42context config list` |
| **`server`** | Start MCP server for external client integration | *None*                            | `--transport <type>`: stdio or http<br>`--port <number>`: Port for HTTP transport | `42context server --transport stdio`                         |
| **`debug`**  | Debugging and testing utilities                  | `<action>`: test-connection, parse<br>`[file]`: File path (for parse action) | *No additional options*                                                    | `42context debug test-connection`                            |
| **`completion`** | Generate shell completion scripts            | `<shell>`: bash, zsh, fish        | *No additional options*                                                    | `42context completion bash`                                  |

### Global Options (Available for All Commands)

| Option               | Description                              | Example                                      |
|----------------------|------------------------------------------|----------------------------------------------|
| `-V, --version`     | Display version information             | `42context --version`       |
| `-d, --debug`       | Enable debug mode with detailed logging | `42context --debug search "test"` |
| `-c, --config <path>` | Specify custom configuration file      | `42context --config my-config.json search "test"` |
| `-h, --help`        | Display help for specific command       | `42context search --help`   |

### Quick Start Examples

```bash
# Install and setup (one-time)
npm install -g @aaswe/42context-engine
42context start-components --detached

# Basic semantic search
42context search "authentication flow"

# Advanced search with filters
42context search "user authentication" \
  --language java \
  --type function \
  --top-k 10 \
  --min-similarity 0.5

# DSPy enhanced search with LLM judgment for disambiguation
42context search "JOSEParser parse" \
  --language java \
  --use-llm-judgment \
  --llm-provider custom

# Index codebase recursively
42context index /path/to/code --recursive

# Analyze specific file
42context analyze src/memory-manager.ts --format json

# Start MCP server for IDE integration (required for MCP clients)
42context server --transport stdio

# Clear all data and start fresh
42context clear --all
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Citation

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