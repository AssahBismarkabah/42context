#!/usr/bin/env node

import { CLIInterface } from './cli.js';
import { getGlobalLogger } from '../core/logger.js';
import { VersionManager } from '../mcp/version.js';

console.log(`[DIAGNOSTIC] 42Context Engine starting in CWD: ${process.cwd()}`);
const logger = getGlobalLogger();

/**
 * Main entry point for 42Context Engine CLI
 * This provides the command-line interface for the context engine
 */
async function main() {
  try {
    const branding = VersionManager.getBranding();
    logger.info(`Starting ${branding.displayName} CLI v${branding.version}...`);

    // Create and setup CLI interface
    const cli = new CLIInterface();
    cli.setupCommands();

    // Parse command line arguments
    const { program } = await import('./cli.js');
    await program.parseAsync(process.argv);
    
  } catch (error) {
    logger.error('CLI command failed:', error);
    console.error('Error:', error);
    process.exit(1);
  }
}

// Start the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };