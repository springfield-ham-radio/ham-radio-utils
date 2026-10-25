#!/usr/bin/env node
import { runPackBetaCli } from './pack-beta.js';

const exitCode = runPackBetaCli(process.argv.slice(2), process.cwd());
process.exit(exitCode);
