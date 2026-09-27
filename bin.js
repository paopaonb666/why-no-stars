#!/usr/bin/env node
import { main, nodeMajor } from './src/cli.js';

if (nodeMajor() < 18) {
  // global fetch and the rest of the tooling need >= 18; fail loudly but kindly.
  console.error(
    `why-no-stars requires Node.js >= 18 (found ${process.versions.node ?? 'unknown'}).\n` +
    '需要 Node.js 18 或更高版本。请升级 Node 后重试：https://nodejs.org'
  );
  process.exitCode = 1;
} else {
  try {
    const code = await main(process.argv.slice(2));
    // process.exitCode (not process.exit) so open keep-alive sockets drain
    // cleanly — process.exit here trips a libuv assertion on Windows.
    if (code) process.exitCode = code;
  } catch (err) {
    console.error(err?.stack ?? String(err));
    process.exitCode = 1;
  }
}
