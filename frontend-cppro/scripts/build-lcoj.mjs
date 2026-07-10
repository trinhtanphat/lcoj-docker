import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const runtimeDir = path.resolve(projectRoot, '..', 'dmoj', 'repo', 'cppro_frontend');

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = npmCli ? [npmCli, 'run', 'build'] : ['run', 'build'];
const child = spawn(command, args, {
  env: {
    ...process.env,
    VITE_CPPRO_DATA_SOURCE: 'lcoj',
  },
  shell: false,
  stdio: 'inherit',
});

// The LCOJ build is backed by the real LCOJ database over /api/v2. The crawled
// oj.cppro.vn snapshot (dist/data, dist/manifests) is stale foreign data and must
// never be shipped: if it is on disk, nginx serves it and the SPA can fall back to it.
const crawlArtifacts = ['data', 'manifests'];

async function stripCrawlArtifacts() {
  for (const entry of crawlArtifacts) {
    await fs.rm(path.join(distDir, entry), { recursive: true, force: true });
  }
}

async function syncRuntimeStatic() {
  await fs.rm(runtimeDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(runtimeDir), { recursive: true });
  await fs.cp(distDir, runtimeDir, { recursive: true });
}

child.on('exit', async (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  if (code) {
    process.exit(code);
    return;
  }
  try {
    await stripCrawlArtifacts();
    console.log(`Stripped crawl artifacts (${crawlArtifacts.join(', ')}) from ${distDir}`);
    await syncRuntimeStatic();
    console.log(`Synced LCOJ runtime frontend to ${runtimeDir}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
