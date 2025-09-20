
<div align="center">
  <h1>MCP Local Context Engine</h1>
  <p><strong>Semantic Code Search and Analysis Platform</strong></p>
</div>

<hr>

<div align="center" style="line-height:1">
  <a href="https://github.com/AssahBismarkabah/42context"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-Repository-blue?logo=github"/></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-18+-green?logo=node.js"/></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript"/></a>
</div>

<div align="center" style="line-height: 1;">
  <a href="https://hub.docker.com/_/chromadb"><img alt="ChromaDB" src="https://img.shields.io/badge/ChromaDB-Vector%20Database-purple?logo=docker"/></a>
  <a href="https://tree-sitter.github.io/"><img alt="Tree-sitter" src="https://img.shields.io/badge/Tree--sitter-Multi--language%20Parsing-orange?logo=tree"/></a>
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
- **Comprehensive CLI**: Full-featured command-line interface with shell completions

### Architecture Overview
The engine combines multiple advanced technologies to provide a unified platform for code analysis and search. It uses Tree-sitter for multi-language parsing, Transformers.js for AI embeddings, and ChromaDB for efficient vector storage and retrieval.

## 2. Technical Specifications

<div align="center">

| | |
|:---:|:---:|
| **Core Language** | TypeScript |
| **Runtime** | Node.js 18+ |
| **Vector Database** | ChromaDB |
| **Embedding Model** | Xenova/all-MiniLM-L6-v2 |
| **Embedding Dimension** | 384 |
| **Parsing Engine** | Tree-sitter |
| **Supported Languages** | 10+ |
| **CLI Framework** | Commander.js |
| **Configuration** | JSON-based |
| **Logging** | Winston |
</div>

## 3. Performance Metrics

### Code Analysis Performance
<div align="center">
<table>
<thead>
<tr>
<th align="center">Metric</th>
<th align="center">Value</th>
<th align="center">Test Dataset</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">Average Parse Time</td>
<td align="center">0.3s per file</td>
<td align="center">Keycloak Java codebase</td>
</tr>
<tr>
<td align="center">Embedding Generation</td>
<td align="center">32 files per batch</td>
<td align="center">Mixed language files</td>
</tr>
<tr>
<td align="center">Vector Storage</td>
<td align="center">34,017 vectors indexed</td>
<td align="center">Keycloak codebase</td>
</tr>
<tr>
<td align="center">Search Latency</td>
<td align="center">11ms average</td>
<td align="center">Semantic queries</td>
</tr>
<tr>
<td align="center">Memory Usage</td>
<td align="center">2GB max configured</td>
<td align="center">Large codebases</td>
</tr>
</tbody>
</table>
</div>

### Language Support Matrix
<div align="center">
<table>
<thead>
<tr>
<th align="center">Language</th>
<th align="center">Extensions</th>
<th align="center">AST Parsing</th>
<th align="center">Documentation Extraction</th>
<th align="center">Dependency Analysis</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">JavaScript</td>
<td align="center">.js, .jsx</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">TypeScript</td>
<td align="center">.ts, .tsx</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">Python</td>
<td align="center">.py</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">Java</td>
<td align="center">.java</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">C/C++</td>
<td align="center">.c, .cpp, .h</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">Rust</td>
<td align="center">.rs</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">Go</td>
<td align="center">.go</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">Ruby</td>
<td align="center">.rb</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
<tr>
<td align="center">PHP</td>
<td align="center">.php</td>
<td align="center">✓</td>
<td align="center">✓</td>
<td align="center">✓</td>
</tr>
</tbody>
</table>
</div>

## 4. Deployment

### Prerequisites
- Node.js 18 or higher
- Docker and Docker Compose
- Git

### Installation
```bash
# Clone repository
git clone https://github.com/AssahBismarkabah/42context.git
cd mcp-local-context-engine

# Install dependencies
npm install

# Start ChromaDB vector database
docker-compose up -d

# Build project
npm run build
```

### Configuration
The engine provides a **comprehensive three-tier configuration system** with automatic validation and flexible customization options.

#### Configuration Hierarchy (Priority Order)
1. **Environment Variables** (highest priority) - `DEV_CONTEXT_*` prefix
2. **JSON Configuration File** - Loaded via `--config` flag
3. **Default Values** (lowest priority) - Optimized for immediate use

#### Configuration Methods

**1. JSON Configuration File**
```bash
# Create custom configuration file
node dist/src/cli-main.js --config my-config.json search "authentication"
```

**Example custom configuration** (`test-config.json`):
```json
{
  "projectPath": "/path/to/project",
  "embedding": {
    "modelName": "Xenova/all-MiniLM-L6-v2",
    "batchSize": 64,
    "maxRetries": 5,
    "retryDelay": 2000
  },
  "vectorStore": {
    "type": "chroma",
    "collectionName": "custom_code_vectors",
    "host": "localhost",
    "port": 8000,
    "embeddingDimension": 384,
    "maxVectorsPerFile": 2000,
    "similarityThreshold": 0.8
  },
  "parser": {
    "maxFileSize": 10485760,
    "chunkSize": 1500,
    "chunkOverlap": 300,
    "supportedLanguages": ["javascript", "typescript", "python", "java"],
    "extractDocumentation": true,
    "extractDependencies": true
  },
  "performance": {
    "maxConcurrentOperations": 20,
    "batchProcessingSize": 64,
    "memoryLimit": 4096,
    "cpuLimit": 90,
    "enableResourceMonitoring": true
  }
}
```

**2. Environment Variables**
```bash
# Set embedding batch size
export DEV_CONTEXT_EMBEDDING_BATCH_SIZE=128

# Set vector store host
export DEV_CONTEXT_VECTOR_STORE_HOST=chromadb.example.com

# Set memory limit
export DEV_CONTEXT_MEMORY_LIMIT=4096

# Run with environment variables
node dist/src/cli-main.js search "authentication"
```

**3. CLI Configuration Commands**
```bash
# View all settings
node dist/src/cli-main.js config list

# Get specific configuration value
node dist/src/cli-main.js config get vectorStore.host

# Set configuration value
node dist/src/cli-main.js config set vectorStore.batchSize 64

# Test configuration changes
node dist/src/cli-main.js config get embedding.batchSize
```

#### Key Configuration Sections

| Section | Purpose | Key Settings |
|---------|---------|--------------|
| **vectorStore** | ChromaDB connection and vector storage | host, port, collectionName, embeddingDimension |
| **embedding** | AI model settings for code embeddings | modelName, batchSize, maxRetries, retryDelay |
| **parser** | Code analysis and chunking | maxFileSize, chunkSize, chunkOverlap, supportedLanguages |
| **fileWatcher** | Real-time file monitoring | ignored patterns, maxFileSize, polling settings |
| **semanticSearch** | Search behavior tuning | maxResults, minSimilarity, enableCaching |
| **performance** | Resource usage limits | maxConcurrentOperations, memoryLimit, cpuLimit |
| **security** | File access and content filtering | allowedFileExtensions, enableSandbox, maxFileSize |
| **logging** | Debug and monitoring output | level, enableConsole, enableFile |




## 5. Usage

### Basic Commands

```bash
# Index a directory recursively
node dist/src/cli-main.js index /path/to/code --recursive

# Search for code semantically
node dist/src/cli-main.js search "authentication flow"

# Analyze code structure
node dist/src/cli-main.js analyze /path/to/file.java --format json

# Start real-time file watching
node dist/src/cli-main.js start --project-path /path/to/project
```

### Advanced Search Examples

```bash
# Search with language filtering
node dist/src/cli-main.js search "user authentication" \
  --language java \
  --type function \
  --top-k 10 \
  --min-similarity 0.5

# Get system statistics
node dist/src/cli-main.js stats

# Manage configuration
node dist/src/cli-main.js config list
node dist/src/cli-main.js config get vectorStore.host

# Debug and testing
node dist/src/cli-main.js debug test-connection
node dist/src/cli-main.js debug parse /path/to/file.java

# Generate shell completions
node dist/src/cli-main.js completion bash
```

### Administrative Commands

```bash
# Clear
# Clear vectors and cache
node dist/src/cli-main.js clear --vectors
node dist/src/cli-main.js clear --cache
node dist/src/cli-main.js clear --all

# Show system statistics
node dist/src/cli-main.js stats --detailed

# Test connections
node dist/src/cli-main.js debug test-connection
```


## 10. License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 11. Citation

If you use MCP Local Context Engine in your research, please cite:

```bibtex
@software{mcp_local_context_engine,
  title={MCP Local Context Engine: Semantic Code Search and Analysis Platform},
  author={Your Organization},
  year={2025},
  url={https://github.com/your-org/mcp-local-context-engine},
  note={Open source semantic code search engine}
}
```

## 12. Contact

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-org/mcp-local-context-engine) or open an issue.