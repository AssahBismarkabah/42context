# 42Context MCP Server Configuration Guide

## Overview

The 42Context Engine now supports both **stdio** and **HTTP/SSE** transport modes for MCP (Model Context Protocol) communication. This guide provides comprehensive configuration instructions for integrating with various MCP clients.

## Transport Modes

### 1. Stdio Transport (Recommended for Local Development)
- **Protocol**: Standard input/output
- **Use Case**: Local development, CLI tools, direct process communication
- **Advantages**: Simple setup, no network configuration required
- **Disadvantages**: Single client per server instance

### 2. HTTP/SSE Transport (Recommended for Remote Access)
- **Protocol**: HTTP with Server-Sent Events
- **Use Case**: Remote access, web-based clients, multiple concurrent connections
- **Advantages**: Network accessible, supports multiple clients, web-friendly
- **Disadvantages**: Requires network configuration, slightly more complex setup

## Available MCP Tools

The 42Context MCP server provides the following tools:

### 1. `code_search`
Search for semantically similar code patterns in the codebase.
- **Required**: `query` (string) - Search query describing what code patterns to find
- **Optional**: 
  - `language` (enum): Filter by programming language
  - `top_k` (number): Number of results to return (1-20, default: 5)
  - `similarity_threshold` (number): Minimum similarity score (0.0-1.0, default: 0.2)

### 2. `context_analysis`
Analyze code structure, complexity, and dependencies.
- **Required**: `file_path` (string) - Path to the file to analyze
- **Optional**:
  - `analysis_type` (enum): Type of analysis (complexity, dependencies, patterns, security, general)
  - `include_related_files` (boolean): Include analysis of related files

### 3. `find_related_code`
Find code related to the current context.
- **Required**: `current_file` (string) - Current file path
- **Optional**:
  - `context_window` (number): Lines of context around cursor
  - `relationship_type` (enum): Type of relationship to find (similar, dependent, referenced)

### 4. `generate_documentation`
Generate documentation for code snippets.
- **Required**: `code_snippet` (string) - Code to generate documentation for
- **Optional**:
  - `documentation_style` (enum): Style of documentation (inline, separate, markdown)
  - `include_examples` (boolean): Include usage examples

## Configuration for Different Clients

### Kilo Code Configuration

Create or update your Kilo Code MCP settings file:

**File**: `~/Library/Application Support/Code/User/globalStorage/kilocode.kilo-code/settings/mcp_settings.json`

```json
{
  "mcpServers": {
    "42context-stdio": {
      "command": "node",
      "args": [
        "--expose-gc",
        "/Users/adorsys123/dev/main/tools/projects/dev/42context/dist/src/cli-main.js",
        "server",
        "--transport",
        "stdio"
      ],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": []
    },
    "42context-http": {
      "url": "http://localhost:3001",
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop Configuration

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "42context": {
      "command": "node",
      "args": [
        "--expose-gc",
        "/Users/adorsys123/dev/main/tools/projects/dev/42context/dist/src/cli-main.js",
        "server",
        "--transport",
        "stdio"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### VS Code MCP Extension

**File**: `.vscode/mcp.json` (in your project root)

```json
{
  "servers": {
    "42context": {
      "type": "stdio",
      "command": "node",
      "args": [
        "--expose-gc",
        "${workspaceFolder}/dist/src/cli-main.js",
        "server",
        "--transport",
        "stdio"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Starting the MCP Server

### Stdio Transport
```bash
# Start with default settings
node dist/src/cli-main.js server --transport stdio

# Start with custom configuration
node dist/src/cli-main.js server --transport stdio --config /path/to/config.json
```

### HTTP/SSE Transport
```bash
# Start with default settings (localhost:3000)
node dist/src/cli-main.js server --transport http

# Start with custom host and port
node dist/src/cli-main.js server --transport http --host 0.0.0.0 --port 8080

# Start in background
node dist/src/cli-main.js server --transport http --port 3001 &
```

## Testing the MCP Server

### Test Stdio Transport
```bash
# List available tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/src/cli-main.js server --transport stdio

# Test code search tool
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"code_search","arguments":{"query":"authentication function","language":"javascript","top_k":3}},"id":2}' | node dist/src/cli-main.js server --transport stdio
```

### Test HTTP Transport
```bash
# Test health endpoint
curl http://localhost:3001/

# Test SSE endpoint (in browser or with curl)
curl -N http://localhost:3001/sse

# Test with proper MCP client initialization
```

## Troubleshooting

### Common Issues

1. **Server not responding**
   - Check if the server is running: `ps aux | grep "cli-main.js server"`
   - Verify transport mode and port configuration
   - Check logs for error messages

2. **Connection refused**
   - Ensure the server is started before connecting clients
   - Verify host and port configuration
   - Check firewall settings for HTTP transport

3. **Tool not found errors**
   - Verify tools are properly registered by checking the `tools/list` response
   - Ensure tool names are spelled correctly
   - Check required parameters are provided

4. **Memory issues**
   - Use `--expose-gc` flag to enable garbage collection
   - Monitor memory usage with `debug memory` command
   - Consider using memory profiles for large codebases

### Debug Commands

```bash
# Test server connections
node dist/src/cli-main.js debug test-connection

# Check memory status
node dist/src/cli-main.js debug memory

# Switch memory profiles
node dist/src/cli-main.js debug memory-profile conservative
```

## Security Considerations

### HTTP Transport Security
- **Development Only**: HTTP transport is intended for development environments
- **Network Binding**: By default binds to `localhost` only
- **CORS**: Enabled for all origins in development mode
- **Production**: Use reverse proxy with HTTPS for production deployments

### Environment Variables
- `NODE_ENV=production`: Enables production optimizations
- Custom configuration paths can be specified via `--config` flag

## Performance Optimization

### Memory Management
The MCP server includes advanced memory management features:
- Automatic garbage collection
- Memory pressure monitoring
- Configurable batch processing
- Embedding model optimization

### Configuration Options
```bash
# Use conservative memory profile for large codebases
node dist/src/cli-main.js server --transport stdio --memory-profile conservative

# Adjust batch sizes for better performance
node dist/src/cli-main.js config set batchSize 25
```

## Integration Examples

### Example 1: Basic Code Search
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "code_search",
    "arguments": {
      "query": "user authentication with JWT tokens",
      "language": "javascript",
      "top_k": 5
    }
  },
  "id": 1
}
```

### Example 2: Code Analysis
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "context_analysis",
    "arguments": {
      "file_path": "/path/to/auth.js",
      "analysis_type": "complexity",
      "include_related_files": true
    }
  },
  "id": 2
}
```

## Support and Updates

For issues, feature requests, or updates:
- Check the project repository for latest documentation
- Review the troubleshooting section for common solutions
- Ensure you're using the latest version of the 42Context Engine

## Version Information

- **42Context Engine**: v0.1.0
- **MCP SDK**: v0.5.0
- **Supported Transports**: stdio, HTTP/SSE
- **Supported Languages**: JavaScript, TypeScript, Python, Java, C/C++, Rust, Go, and more