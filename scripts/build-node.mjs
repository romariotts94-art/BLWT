import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
const child = spawn(process.execPath, [fileURLToPath(vite), 'build', '--config', 'vite.node.config.ts'], {
  env: { ...process.env, NITRO_PRESET: 'node' },
  stdio: 'inherit',
});

child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
