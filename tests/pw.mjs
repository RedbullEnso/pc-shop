// Gemeinsamer Start für die Browser-Tests. Nutzt das Playwright, das mit Claude Code (MCP) installiert ist.
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const globalModules = process.env.PW_MODULES
  || join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node-v24.19.0-win-x64/node_modules');
const require = createRequire(join(globalModules, 'x.js'));
const { chromium } = require(join(globalModules, '@playwright/mcp/node_modules/playwright-core/index.js'));

function findChromium() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
  return dir ? join(base, dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') : undefined;
}

export async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: findChromium() });
  }
}

export const BASE = process.env.BASE || 'http://127.0.0.1:5176';
