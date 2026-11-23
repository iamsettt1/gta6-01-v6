// Puerto Brisa 3D — Storm Surge: the hand-in program (Node 22,
// standard library only). The game itself is this directory's game/
// folder — plain static files a desktop browser loads offline
// (game/index.html and its ES modules: a hand-written WebGL open
// world, no library, no network request). This program copies game/
// and screenshots/ from beside itself into /output and writes
// /output/dossier.json, the summary the judge reads, using the
// vendored make.fun library and the scorer's own caps.
//
// Serve it locally with `node serve.ts`, then open
// http://localhost:8080 (the game itself is game/index.html; the
// four scenes in shots.json render its screenshots). Outside the
// grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps come from the scorer's gate: past them the entry would be
// refused (more than 4 screenshots or one over 256 KiB; more than
// 993 files in game/ or 48 MiB of game files in all; a path under
// game/ over 1000 bytes). Only text_max_bytes shapes the dossier's
// own bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
