/**
 * DSEEK CLI entry point
 */

import { runCLI } from '../src/cli/index.js';

runCLI().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
