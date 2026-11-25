// Ember & Basil — entry packager for make.fun's "Make the best cooking game" bounty.
// Copies the offline static web game under game/ and its real browser captures under screenshots/
// into /output (or $MAKEFUN_OUTPUT_DIR locally), ensures readable permissions, and builds the
// canonical /output/dossier.json deterministically using vendor/makefun-game.ts.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

function ensureChildrenReadable(dirPath: string): void {
  if (process.platform === 'win32') return;
  for (const entry of readdirSync(dirPath)) {
    const child = join(dirPath, entry);
    const info = statSync(child);
    try {
      chmodSync(child, info.isDirectory() ? 0o755 : 0o644);
    } catch {
      // Ignore if filesystem restricts chmod on pre-existing mount points.
    }
    if (info.isDirectory()) {
      ensureChildrenReadable(child);
    }
  }
}

function packageEntry(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  cpSync(join(ROOT_DIR, 'game'), join(OUTPUT_DIR, 'game'), { recursive: true });

  const shotsSrc = join(ROOT_DIR, 'screenshots');
  const shotsDst = join(OUTPUT_DIR, 'screenshots');
  mkdirSync(shotsDst, { recursive: true });
  if (existsSync(shotsSrc)) {
    cpSync(shotsSrc, shotsDst, { recursive: true });
  }

  const dossierBytes = buildDossier(OUTPUT_DIR, GATE_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossierBytes);
  ensureChildrenReadable(OUTPUT_DIR);
}

packageEntry();
