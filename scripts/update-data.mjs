#!/usr/bin/env node
// Copies the public source files into ./data so the server never touches the network.
//
// Sources (override with environment variables):
//   VARGOV_KB_DIR      — root of the vargov-ai-kb repository (default: ../../.. from this script,
//                        i.e. the repository that contains tools/vargov-mcp)
//   CONFIGURATOR_DIR   — working copy of the configurator (required; no default);
//                        only its public/ folder is read: open-skus.json and llms.txt — both are
//                        served publicly at https://vargov.design/open-skus.json and /llms.txt
//
// Writes data/manifest.json with sha256 and byte size of every copied file. The manifest ships in the
// npm package, so it names each source by its public place (repository path or URL), never by a local path.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const dataDir = join(pkgRoot, 'data');
const kbDir = resolve(process.env.VARGOV_KB_DIR ?? resolve(pkgRoot, '..', '..'));
if (!process.env.CONFIGURATOR_DIR) {
  console.error('Set CONFIGURATOR_DIR to the working copy of the configurator (its public/ folder is read).');
  process.exit(1);
}
const cfgDir = resolve(process.env.CONFIGURATOR_DIR);

const SOURCES = [
  { to: 'products.json', src: 'vargov-ai-kb/datasets/products.json', from: join(kbDir, 'datasets', 'products.json'), required: true, kind: 'json' },
  { to: 'organization.jsonld', src: 'vargov-ai-kb/references/organization.jsonld', from: join(kbDir, 'references', 'organization.jsonld'), required: true, kind: 'json' },
  { to: 'brand-facts.json', src: 'vargov-ai-kb/references/brand-facts.json', from: join(kbDir, 'references', 'brand-facts.json'), required: false, kind: 'json' },
  { to: 'sketchfab-models.json', src: 'vargov-ai-kb/references/sketchfab-models.json', from: join(kbDir, 'references', 'sketchfab-models.json'), required: false, kind: 'json' },
  { to: 'llms-en.txt', src: 'vargov-ai-kb/en/llms.txt', from: join(kbDir, 'en', 'llms.txt'), required: true, kind: 'text' },
  { to: 'llms-ru.txt', src: 'vargov-ai-kb/llms.txt', from: join(kbDir, 'llms.txt'), required: true, kind: 'text' },
  { to: 'open-skus.json', src: 'https://vargov.design/open-skus.json', from: join(cfgDir, 'public', 'open-skus.json'), required: true, kind: 'json' },
  { to: 'llms-configurator.txt', src: 'https://vargov.design/llms.txt', from: join(cfgDir, 'public', 'llms.txt'), required: false, kind: 'text' },
];

mkdirSync(dataDir, { recursive: true });

// Commit of each source repository, so a snapshot can be traced without exposing local folders.
function headOf(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const manifest = {
  updated_at: new Date().toISOString(),
  sources: { 'vargov-ai-kb': headOf(kbDir), configurator: headOf(cfgDir) },
  files: [],
};
let failed = false;

for (const s of SOURCES) {
  if (!existsSync(s.from)) {
    if (s.required) {
      console.error(`MISSING (required): ${s.from}`);
      failed = true;
    } else {
      console.error(`skipped (optional, not found): ${s.from}`);
    }
    continue;
  }
  const buf = readFileSync(s.from);
  if (s.kind === 'json') {
    try {
      JSON.parse(buf.toString('utf8'));
    } catch (e) {
      console.error(`NOT VALID JSON: ${s.from}: ${e.message}`);
      failed = true;
      continue;
    }
  }
  copyFileSync(s.from, join(dataDir, s.to));
  const sha256 = createHash('sha256').update(buf).digest('hex');
  manifest.files.push({ file: s.to, from: s.src, bytes: buf.length, sha256 });
  console.error(`copied ${s.to}  ${buf.length} bytes  sha256 ${sha256.slice(0, 12)}…`);
}

// The ceramic collection: the three groups the site publishes at https://vargov.ru/en/ceramics, derived from the
// owner's material marking in the site's element-specs (origin/main). Only group membership is copied — no other
// material data. Set SITE_REPO to the site's working copy; without it the existing data/ceramics.json is kept.
if (process.env.SITE_REPO) {
  try {
    const raw = execFileSync('git', ['-C', process.env.SITE_REPO, 'show', 'origin/main:src/lib/data/element-specs.generated.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const specs = JSON.parse(raw);
    const items = specs.items ?? specs;
    const groups = { ceramic: [], ceramic_mix: [], ceramic_or_white_glass: [] };
    for (const [sku, v] of Object.entries(items)) {
      if (!v || v.elementMaterialsFrom !== 'owner') continue;
      const em = v.elementMaterials ?? [];
      if (!em.includes('ceramic')) continue;
      const g = v.elementMaterialsEither ? 'ceramic_or_white_glass' : em.length === 1 ? 'ceramic' : 'ceramic_mix';
      groups[g].push(sku.toUpperCase());
    }
    for (const k of Object.keys(groups)) groups[k].sort();
    const out = JSON.stringify({ source: 'https://vargov.ru/en/ceramics', site_commit: headOf(process.env.SITE_REPO), groups }, null, 1) + '\n';
    writeFileSync(join(dataDir, 'ceramics.json'), out);
    const sha256 = createHash('sha256').update(out).digest('hex');
    manifest.files.push({ file: 'ceramics.json', from: 'https://vargov.ru/en/ceramics (owner material marking of the site)', bytes: Buffer.byteLength(out), sha256 });
    console.error(`ceramics: ${groups.ceramic.length} ceramic, ${groups.ceramic_mix.length} ceramic with glass or crystal, ${groups.ceramic_or_white_glass.length} ceramic or opaque white glass`);
  } catch (e) {
    console.error(`ceramics: FAILED (${e.message})`);
    failed = true;
  }
} else if (existsSync(join(dataDir, 'ceramics.json'))) {
  console.error('ceramics: SITE_REPO not set — data/ceramics.json kept as it is');
}

// sanity counts — the numbers the README promises
try {
  const products = JSON.parse(readFileSync(join(dataDir, 'products.json'), 'utf8'));
  const open = JSON.parse(readFileSync(join(dataDir, 'open-skus.json'), 'utf8'));
  manifest.counts = {
    products: Array.isArray(products) ? products.length : null,
    open_skus: Array.isArray(open.skus) ? open.skus.length : null,
  };
  console.error(`products: ${manifest.counts.products}, open skus: ${manifest.counts.open_skus}`);
} catch (e) {
  console.error(`count check failed: ${e.message}`);
  failed = true;
}

writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (failed) {
  console.error('update-data: FAILED');
  process.exit(1);
}
console.error('update-data: done');
