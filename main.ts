// Tanjung Emas — the entry program (Node 22, standard library only).
//
// What it does, in order:
//   1. Finds the repository root (the folder holding this file).
//   2. Copies game/ and screenshots/ into the output directory.
//   3. Writes /output/dossier.json with the kit's buildDossier, using the
//      scorer's own caps, so the dossier the judge reads is byte for byte
//      what the gate rebuilds.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice: both runs must write identical bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, copied from the gate: text_max_bytes is the only one that
// shapes the dossier bytes; the rest refuse an entry the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function mustExist(path, what) {
  if (!existsSync(path)) throw new Error(`missing ${what}: ${path}`);
}

function copyGameTree() {
  const gameDir = join(repoRoot, 'game');
  mustExist(gameDir, 'game directory');
  const indexHtml = join(gameDir, 'index.html');
  mustExist(indexHtml, 'game/index.html');
  if (statSync(indexHtml).size > 1024 * 1024) {
    throw new Error('game/index.html is over the 1 MiB cap');
  }
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  const shotsDir = join(repoRoot, 'screenshots');
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    const shots = readdirSync(shotsDir).filter((f) => !f.startsWith('.'));
    if (shots.length < 3 || shots.length > 4) {
      throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
    }
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }
}

copyGameTree();
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
