/**
 * CLI entry point - Commander.js setup
 *
 * Registers all commands and exports CLI runner.
 *
 * @module cli
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { auditCommand } from './commands/audit.js';
import { bootstrapCommand } from './commands/bootstrap.js';
import { chatCommand } from './commands/chat.js';
import { deleteCommand } from './commands/delete.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
import { statusCommand } from './commands/status.js';
import { watchCommand } from './commands/watch.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');

export function createCLI(): Command {
  const program = new Command();

  program
    .name('dseek')
    .description('Local documentation search with hybrid retrieval for Claude Code')
    .version(VERSION);

  // Register commands
  program.addCommand(bootstrapCommand);
  program.addCommand(addCommand);
  program.addCommand(searchCommand);
  program.addCommand(chatCommand);
  program.addCommand(statusCommand);
  program.addCommand(listCommand);
  program.addCommand(deleteCommand);
  program.addCommand(auditCommand);
  program.addCommand(watchCommand);

  return program;
}

export async function runCLI(args: string[] = process.argv): Promise<void> {
  const program = createCLI();
  await program.parseAsync(args);
}
