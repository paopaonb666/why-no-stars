#!/usr/bin/env node
import { main } from './src/cli.js';

try {
  const code = await main(process.argv.slice(2));
  // process.exitCode (not process.exit) so open keep-alive sockets drain
  // cleanly — process.exit here trips a libuv assertion on Windows.
  if (code) process.exitCode = code;
} catch (err) {
  console.error(err?.stack ?? String(err));
  process.exitCode = 1;
}
