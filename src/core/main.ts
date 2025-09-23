#!/usr/bin/env node

import { MCPServer } from '../mcp/mcp-server.js';
import { getGlobalLogger } from './logger.js';
import { VersionManager } from '../mcp/version.js';

const logger = getGlobalLogger();

/**
 * Main entry point for MCP Local Context Engine Server
 * This starts the MCP server that external clients can connect to
 */
async function main() {
  try {
    const branding = VersionManager.getBranding();
    logger.info(`Starting ${branding.displayName} MCP Server v${branding.version}...`);

    // Create and start MCP server
    const server = new MCPServer({
      serverName: '42context-mcp-server',
      version: VersionManager.getVersion(),
      transportType: 'stdio'
    });

    await server.start();
    
    logger.info(`${branding.displayName} MCP Server started successfully`);
    logger.info('Server is ready to accept MCP client connections');
    logger.info('Press Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info(`Shutting down ${branding.displayName} MCP server...`);
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info(`Shutting down ${branding.displayName} MCP server...`);
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };