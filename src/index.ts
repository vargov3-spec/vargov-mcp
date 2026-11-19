#!/usr/bin/env node
// Entry point: MCP server over stdio. Nothing but the protocol goes to stdout; diagnostics go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getData } from './data.js';
import { SERVER_NAME, SERVER_VERSION, createServer } from './server.js';

async function main() {
  const d = getData(); // fail fast if data/ is missing
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION}: ${d.products.length} compositions, ${d.openSet.size} open in the configurator; stdio ready\n`);
}

main().catch((err) => {
  process.stderr.write(`${SERVER_NAME}: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
