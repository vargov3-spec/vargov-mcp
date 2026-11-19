// Loads the bundled data (./data) once and builds the indexes the tools use.
// The server never reads the network: every fact comes from these files.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // dist/
export const DATA_DIR = join(here, '..', 'data');

export const LANGS = ['ru', 'en', 'de', 'it', 'fr', 'es', 'vi', 'ar'] as const;
export type Lang = (typeof LANGS)[number];

export const FAMILIES = ['lighting', 'decorative', 'sculptural-decor', 'floor-table-lamps'] as const;
export type Family = (typeof FAMILIES)[number];

export interface Award {
  program: string;
  program_en?: string;
  year: string;
  level_en: string;
  level_ru: string;
  href: string;
  series?: boolean;
}

export interface Product {
  code: string;
  slug: string;
  category: Family;
  category_label: { ru: string; en: string };
  type: Record<string, string>;
  urls: Record<string, string>;
  image: string;
  gallery: string[];
  gallery_total: number;
  model3d: string | null;
  model3d_en: string | null;
  models_all: string | null;
  models_all_en: string | null;
  award_winning: boolean;
  cert: unknown;
  awards: Award[];
  in_stock_elements: unknown[];
  description: Record<string, string>;
  where_it_works: Record<string, string>;
  style: Record<string, string>;
  made_to_order: Record<string, string>;
  snippet: Record<string, string>;
}

export interface Series {
  sh?: number[];
  sd?: number[];
  sdAxis?: 'D' | 'L';
  labels?: Record<string, string>;
  ribbon?: boolean;
  chain?: boolean;
}

export interface OpenSkus {
  rule: string;
  count: number;
  skus: string[];
  series: Record<string, Series>;
  roundRule?: string;
  roundForms?: string[];
  diodeSku?: string;
  diodesRule?: string;
  diodes?: Record<string, unknown>;
  mixRule?: string;
  mixPairs?: Record<string, string>;
  framesRule?: string;
  frames?: string[];
  /** Ready scenes (own 3D model, no calculated layout). Added by the configurator 26.10.2026, source scene3d in the model data. */
  scenesRule?: string;
  scenes?: string[];
}

export interface SketchfabItem {
  uid: string;
  url: string;
  count: number;
}

export interface OrganizationNode {
  name: string;
  alternateName?: string[];
  url: string;
  description?: string;
  email?: string;
  telephone?: string;
  foundingDate?: string;
  address?: { streetAddress: string; addressLocality: string; postalCode?: string; addressCountry: string };
  award?: string[];
  identifier?: { propertyID: string; value: string; url?: string }[];
  sameAs?: string[];
}

export interface PersonNode {
  name: string;
  alternateName?: string;
  jobTitle?: string;
  url?: string;
  sameAs?: string[];
}

export interface StoreNode {
  name: string;
  url?: string;
  telephone?: string[] | string;
  address?: { streetAddress: string; addressLocality: string; postalCode?: string; addressCountry: string };
  openingHoursSpecification?: { dayOfWeek: string[]; opens: string; closes: string }[];
  hasMap?: string[];
}

export interface Manifest {
  updated_at?: string;
  files?: { file: string; from: string; bytes: number; sha256: string }[];
  counts?: { products: number | null; open_skus: number | null };
}

/** How the configurator treats a composition it opens with a full calculation. */
export type Kind = 'cloud' | 'ribbon' | 'chain' | 'frame' | 'ready-scene';

export interface Entry {
  p: Product;
  code: string; // canonical, upper case
  nameRu: string; // "<type.ru> <code>" — the same naming the site and the knowledge base use
  nameEn: string;
  lit: boolean; // derived hint, see isLit()
  configurable: boolean; // in open-skus.json
  kind: Kind | null;
  // lower-cased search fields
  f: { code: string; type: string; where: string; style: string; desc: string; other: string };
}

export interface Data {
  products: Product[];
  entries: Entry[];
  byCode: Map<string, Entry>;
  open: OpenSkus;
  openSet: Set<string>;
  ribbons: Set<string>;
  chains: Set<string>;
  frames: Set<string>;
  readyScenes: Set<string>;
  sketchfab: Map<string, SketchfabItem>;
  organization: OrganizationNode | null;
  person: PersonNode | null;
  store: StoreNode | null;
  brandFacts: Record<string, unknown> | null;
  llmsEn: string;
  llmsRu: string;
  llmsConfigurator: string | null;
  manifest: Manifest | null;
}

/**
 * Ready scenes: compositions that open in the configurator as a ready-made 3D model, not as a
 * calculated cloud of elements. Since 26.10.2026 the configurator publishes them in open-skus.json as `scenes`
 * (source: scene3d in its model data); this constant is only the fallback for an older open-skus.json without the field.
 * Before that field existed the public sources named one:
 *  - en/llms.txt and knowledge/whats-new-2026-10.md (vargov-ai-kb): "the ready scene LC0406-1 — a wall light
 *    whose composition is ready-made rather than calculated, so there is no layout and no ceiling setting-out";
 *  - open-skus.json `rule`: "ready-made pieces shown as their own 3D model, e.g. the LC0406-1 wall sconce".
 * The 1:1 drawing count published by the brand (345 of 360) = 360 − 10 ribbons − 4 frames − this 1 ready scene;
 * test/smoke.mjs checks that equation against the bundled data.
 */
const READY_SCENES = ['LC0406-1'];

function readText(name: string): string | null {
  const file = join(DATA_DIR, name);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function readJson<T>(name: string, required: boolean): T | null {
  const txt = readText(name);
  if (txt === null) {
    if (required) throw new Error(`vargov-mcp: required data file missing: ${join(DATA_DIR, name)} — run "npm run update-data"`);
    return null;
  }
  return JSON.parse(txt) as T;
}

/** Normalises user input to the catalogue code form: "lc0564" → "LC0564", " LC 0406-1 " → "LC0406-1", "564" → "LC0564". */
export function normalizeCode(input: string): string {
  let s = String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{1,4}(-\d)?$/.test(s)) {
    const [num, suffix] = s.split('-');
    s = 'LC' + num.padStart(4, '0') + (suffix ? '-' + suffix : '');
  }
  return s;
}

/**
 * `lit` is a hint derived from public labels, not a measured property:
 * true for the "lighting" family and for any type label that mentions light / lamp / backlit / luminaire.
 */
export function isLit(p: Product): boolean {
  if (p.category === 'lighting') return true;
  return /\b(light|lamp|backlit|luminaire|illuminat)/i.test(p.type?.en ?? '');
}

function lower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase().normalize('NFC') : '';
}

function joinLangs(rec: Record<string, string> | undefined, langs: readonly string[]): string {
  if (!rec) return '';
  return langs.map((l) => lower(rec[l])).filter(Boolean).join(' \n ');
}

let cached: Data | null = null;

export function getData(): Data {
  if (cached) return cached;

  const products = readJson<Product[]>('products.json', true)!;
  const open = readJson<OpenSkus>('open-skus.json', true)!;
  const sketchfabRaw = readJson<{ items?: Record<string, SketchfabItem> }>('sketchfab-models.json', false);
  const orgRaw = readJson<{ '@graph'?: Record<string, unknown>[] }>('organization.jsonld', true)!;
  const brandFacts = readJson<Record<string, unknown>>('brand-facts.json', false);
  const manifest = readJson<Manifest>('manifest.json', false);
  const llmsEn = readText('llms-en.txt') ?? '';
  const llmsRu = readText('llms-ru.txt') ?? '';
  const llmsConfigurator = readText('llms-configurator.txt');

  const graph = orgRaw['@graph'] ?? [];
  const pick = <T>(type: string): T | null => (graph.find((n) => n['@type'] === type) as T | undefined) ?? null;

  const openSet = new Set(open.skus.map((s) => s.toUpperCase()));
  const ribbons = new Set<string>();
  const chains = new Set<string>();
  for (const [sku, s] of Object.entries(open.series ?? {})) {
    if (s.ribbon) ribbons.add(sku.toUpperCase());
    if (s.chain) chains.add(sku.toUpperCase());
  }
  const frames = new Set((open.frames ?? []).map((s) => s.toUpperCase()));
  const readyScenes = new Set((open.scenes ?? READY_SCENES).map((s) => s.toUpperCase()).filter((s) => openSet.has(s)));

  const kindOf = (code: string): Kind | null => {
    if (!openSet.has(code)) return null;
    if (ribbons.has(code)) return 'ribbon';
    if (chains.has(code)) return 'chain';
    if (frames.has(code)) return 'frame';
    if (readyScenes.has(code)) return 'ready-scene';
    return 'cloud';
  };

  const otherLangs = LANGS.filter((l) => l !== 'ru' && l !== 'en');
  const entries: Entry[] = products.map((p) => {
    const code = p.code.toUpperCase();
    return {
      p,
      code,
      nameRu: `${p.type?.ru ?? p.category_label?.ru ?? ''} ${p.code}`.trim(),
      nameEn: `${p.type?.en ?? p.category_label?.en ?? ''} ${p.code}`.trim(),
      lit: isLit(p),
      configurable: openSet.has(code),
      kind: kindOf(code),
      f: {
        code: `${code.toLowerCase()} ${lower(p.slug)}`,
        type: [joinLangs(p.type, LANGS), lower(p.category_label?.ru), lower(p.category_label?.en), lower(p.category)].join(' '),
        where: joinLangs(p.where_it_works, ['ru', 'en']),
        style: joinLangs(p.style, ['ru', 'en']),
        desc: joinLangs(p.description, ['ru', 'en']) + ' ' + joinLangs(p.made_to_order, ['ru', 'en']),
        other: [p.description, p.where_it_works, p.style].map((r) => joinLangs(r, otherLangs)).join(' '),
      },
    };
  });

  const byCode = new Map<string, Entry>();
  for (const e of entries) byCode.set(e.code, e);

  const sketchfab = new Map<string, SketchfabItem>();
  for (const [code, item] of Object.entries(sketchfabRaw?.items ?? {})) sketchfab.set(code.toUpperCase(), item);

  cached = {
    products,
    entries,
    byCode,
    open,
    openSet,
    ribbons,
    chains,
    frames,
    readyScenes,
    sketchfab,
    organization: pick<OrganizationNode>('Organization'),
    person: pick<PersonNode>('Person'),
    store: pick<StoreNode>('Store'),
    brandFacts,
    llmsEn,
    llmsRu,
    llmsConfigurator,
    manifest,
  };
  return cached;
}
