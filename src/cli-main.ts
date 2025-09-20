#!/usr/bin/env node

import { CLIInterface, program } from './cli.js';

// Create and setup CLI
const cli = new CLIInterface();
cli.setupCommands();

// Parse command line arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}