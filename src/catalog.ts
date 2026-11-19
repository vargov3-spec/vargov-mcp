// Tool logic: search, composition card, configurator link. Pure functions over getData().

import { FAMILIES, LANGS, getData, normalizeCode, type Entry, type Family, type Kind, type Lang } from './data.js';
import { dealerRouteLine } from './dealers.js';

export const SEARCH_LIMIT_MAX = 50;
export const SEARCH_LIMIT_DEFAULT = 10;
const TEXT_CAP = 2000;

export const SITE = 'https://vargov.ru';
/** Hosts of the configurator: the Russian interface lives on the Russian copy, every other language on vargov.design
 *  (docs/ssylka-i-tekst-dlya-tz.md of the configurator, section 4; the knowledge base links them the same way). */
export const CONFIGURATOR_RU = 'https://configurator.vargov.ru/';
export const CONFIGURATOR_INTL = 'https://vargov.design/';

export function cap(s: string | undefined | null, n = TEXT_CAP): string | undefined {
  if (!s) return undefined;
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function sitePage(code: string, lang: Lang = 'en'): string {
  const slug = code.toLowerCase();
  return lang === 'ru' ? `${SITE}/catalog/${slug}` : `${SITE}/${lang}/catalog/${slug}`;
}

// ---------------------------------------------------------------------------------------------
// search_compositions

export interface SearchParams {
  query?: string;
  family?: Family;
  lit?: boolean;
  awarded?: boolean;
  configurable?: boolean;
  limit?: number;
}

export interface SearchRow {
  code: string;
  name_en: string;
  name_ru: string;
  family: Family;
  type_en: string;
  configurable: boolean;
  kind: Kind | null;
  awarded: boolean;
  lit_hint: boolean;
  page_en: string;
  page_ru: string;
  image: string;
  snippet_en?: string;
}

const CODE_RE = /^lc\d{4}(-\d)?$/i;

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}-]+/u)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 2);
}

interface Tok {
  raw: string;
  code: string | null; // normalised code when the token looks like one
  res: RegExp[]; // word-level matchers, from strict to tolerant
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_START = '(?:^|[^\\p{L}\\p{N}])';
const WORD_END = '(?=$|[^\\p{L}\\p{N}])';

/**
 * Word-level matching with a light stem tolerance:
 *  - short tokens (< 5 letters) match whole words only ("spa" does not find "space");
 *  - longer tokens match the start of a word ("lobby" finds "lobbies"), and so do their stems
 *    minus one letter (≥ 5) and minus two letters (≥ 7): "гостиная" finds "гостиной".
 */
function compileToken(t: string): Tok {
  const isCode = CODE_RE.test(t) || /^\d{4}$/.test(t);
  if (isCode) return { raw: t, code: normalizeCode(t), res: [] };
  const res: RegExp[] = [];
  if (t.length < 5) res.push(new RegExp(WORD_START + esc(t) + WORD_END, 'u'));
  else {
    res.push(new RegExp(WORD_START + esc(t), 'u'));
    res.push(new RegExp(WORD_START + esc(t.slice(0, -1)), 'u'));
    if (t.length >= 7) res.push(new RegExp(WORD_START + esc(t.slice(0, -2)), 'u'));
  }
  return { raw: t, code: null, res };
}

function hit(field: string, tok: Tok): boolean {
  if (!field) return false;
  for (const re of tok.res) if (re.test(field)) return true;
  return false;
}

function scoreEntry(e: Entry, toks: Tok[]): { score: number; matched: number } {
  let score = 0;
  let matched = 0;
  for (const t of toks) {
    let s = 0;
    if (t.code) {
      // a code token matches codes only — no tolerance, or "LC0564" would bring every LC05xx
      if (e.code === t.code) s += 1000;
      else if (e.code.startsWith(t.code)) s += 500; // LC0543 also brings LC0543-1, LC0543-2
      if (s > 0) matched++;
      score += s;
      continue;
    }
    if (hit(e.f.code, t)) s += 100;
    if (hit(e.f.type, t)) s += 10;
    if (hit(e.f.where, t)) s += 5;
    if (hit(e.f.style, t)) s += 3;
    if (hit(e.f.desc, t)) s += 1;
    if (s === 0 && hit(e.f.other, t)) s += 1;
    if (s > 0) matched++;
    score += s;
  }
  return { score, matched };
}

export function searchCompositions(params: SearchParams): { total_matches: number; shown: number; results: SearchRow[]; note?: string } {
  const d = getData();
  const limit = Math.max(1, Math.min(SEARCH_LIMIT_MAX, Math.floor(params.limit ?? SEARCH_LIMIT_DEFAULT)));
  const toks = tokens(params.query ?? '').map(compileToken);

  let pool = d.entries.filter((e) => {
    if (params.family && e.p.category !== params.family) return false;
    if (params.lit !== undefined && e.lit !== params.lit) return false;
    if (params.awarded !== undefined && e.p.award_winning !== params.awarded) return false;
    if (params.configurable !== undefined && e.configurable !== params.configurable) return false;
    return true;
  });

  let note: string | undefined;
  let scored: { e: Entry; score: number }[];
  if (toks.length === 0) {
    scored = pool.map((e) => ({ e, score: 0 }));
  } else {
    const all = pool.map((e) => ({ e, ...scoreEntry(e, toks) }));
    let kept = all.filter((x) => x.matched === toks.length && x.score > 0);
    if (kept.length === 0) {
      kept = all.filter((x) => x.score > 0);
      if (kept.length > 0) note = 'No composition matched every word of the query; showing compositions that match some of them.';
    }
    scored = kept;
  }

  scored.sort((a, b) => b.score - a.score || Number(b.e.p.award_winning) - Number(a.e.p.award_winning) || a.e.code.localeCompare(b.e.code));
  const results = scored.slice(0, limit).map(({ e }) => toRow(e));
  return { total_matches: scored.length, shown: results.length, results, ...(note ? { note } : {}) };
}

function toRow(e: Entry): SearchRow {
  return {
    code: e.code,
    name_en: e.nameEn,
    name_ru: e.nameRu,
    family: e.p.category,
    type_en: e.p.type?.en ?? '',
    configurable: e.configurable,
    kind: e.kind,
    awarded: e.p.award_winning,
    lit_hint: e.lit,
    page_en: e.p.urls?.en ?? sitePage(e.code, 'en'),
    page_ru: e.p.urls?.ru ?? sitePage(e.code, 'ru'),
    image: e.p.image,
    snippet_en: cap(e.p.snippet?.en, 200),
  };
}

// ---------------------------------------------------------------------------------------------
// get_composition

export function findEntry(codeInput: string): Entry | null {
  return getData().byCode.get(normalizeCode(codeInput)) ?? null;
}

export function mountSchemeNote(kind: Kind | null): string | null {
  switch (kind) {
    case 'ribbon':
      return 'No 1:1 ceiling drawing: a ribbon has no cloud of elements; it is built differently.';
    case 'frame':
      return 'No 1:1 ceiling drawing: the elements have no strands of their own to the ceiling — they hang from the frame, and the frame itself is suspended from the ceiling; the IFC4 file records the number of frame suspensions (property SuspensionCount) but not their coordinates, and the suspension points themselves are shown on the frame drawing and on the side view in the configurator.';
    case 'ready-scene':
      return 'No 1:1 ceiling drawing: it is a wall sconce — the composition is ready-made rather than calculated, so there is no layout and no ceiling setting-out; the IFC4 file has no ceiling fixing points.';
    default:
      return null;
  }
}

export function hasMountScheme(kind: Kind | null): boolean {
  return kind === 'cloud' || kind === 'chain';
}

export function kindNotes(code: string, kind: Kind | null): string[] {
  const notes: string[] = [];
  if (kind === 'ribbon') notes.push('Ribbon: the plan Length/Width and the composition height are read from the link; the ribbon shape (wave/spiral) is chosen in the configurator; the FBX export button of a ribbon is in the ribbon panel.');
  if (kind === 'chain') notes.push('Chain composition: the form card has no effect on the assembly — the configurator lays the chain out with its own engine.');
  if (kind === 'frame') notes.push('Composition on a load-bearing frame: the number of elements is computed by the configurator from the frame pitch and length and cannot be typed by hand.');
  if (kind === 'ready-scene') notes.push('Ready scene: the composition opens as its own 3D model; plan dimensions in the link are replaced by the size of the piece; there is no ceiling-height field: the IFC4 model is placed under a 2,700 mm ceiling (the default), and the file does not declare that height as a property.');
  if (code === 'LC0106') notes.push('LC0106: instead of plan dimensions the configurator takes the number of jellyfish and the gap between them (link keys jelly and jgap); w/l/h in the link are not used for this composition.');
  return notes;
}

export function compositionCard(codeInput: string, lang: Lang = 'en') {
  const d = getData();
  const e = findEntry(codeInput);
  if (!e) return null;
  const p = e.p;
  const L: Lang = LANGS.includes(lang) ? lang : 'en';
  const sk = d.sketchfab.get(e.code);

  const configurator = e.configurable
    ? {
        opens_with_full_calculation: true,
        kind: e.kind,
        exports: ['IFC4 model (BIM)', 'FBX model (3ds Max)', 'PDF specification', 'tender sheet'],
        mount_scheme_1to1: hasMountScheme(e.kind),
        ...(mountSchemeNote(e.kind) ? { mount_scheme_1to1_note: mountSchemeNote(e.kind) } : {}),
        // element_size_series_mm (ряды размеров элементов из open-skus.json) снят 27.10.2026 до слова владельца:
        // правило бренда «размеры не называть» — решение за ним, вернуть можно, восстановив этот блок из истории.
        ...(d.open.mixPairs?.[e.code] ? { paired_with: d.open.mixPairs[e.code] } : {}),
        link_en: linkUrl(e.code, 'en'),
        link_ru: linkUrl(e.code, 'ru'),
        notes: kindNotes(e.code, e.kind),
        how_to_get_bim: 'call how_to_get_bim with this code',
      }
    : {
        opens_with_full_calculation: false,
        note: 'Calculated individually: the configurator does not calculate this composition, so it has no IFC4/FBX export, no PDF specification from the configurator and no 1:1 ceiling drawing. The link below opens the configurator showcase without a calculation; the production brief cannot be started for it. Contact the brand for a calculation.',
        link_en: `${CONFIGURATOR_INTL}?sku=${encodeURIComponent(e.code)}&lang=en`,
        link_ru: `${CONFIGURATOR_RU}?sku=${encodeURIComponent(e.code)}&lang=ru`,
      };

  const otherType = L !== 'ru' && L !== 'en' && p.type?.[L] ? { [L]: p.type[L] } : {};

  return {
    code: e.code,
    name: { ru: e.nameRu, en: e.nameEn },
    family: p.category,
    family_label: p.category_label,
    type: { ru: p.type?.ru, en: p.type?.en, ...otherType },
    lit_hint: e.lit,
    pages: p.urls,
    image: p.image,
    gallery_images: p.gallery_total,
    texts: {
      lang: L,
      description: cap(p.description?.[L] ?? p.description?.en),
      where_it_works: cap(p.where_it_works?.[L] ?? p.where_it_works?.en),
      style: cap(p.style?.[L] ?? p.style?.en),
      made_to_order: cap(p.made_to_order?.[L] ?? p.made_to_order?.en),
    },
    models_3d: {
      ...(p.model3d ? { '3ddd_ru': p.model3d } : {}),
      ...(p.model3d_en ? { '3dsky_en': p.model3d_en } : {}),
      ...(p.models_all ? { all_models_3ddd: p.models_all } : {}),
      ...(p.models_all_en ? { all_models_3dsky: p.models_all_en } : {}),
      ...(sk ? { sketchfab: { url: sk.url, published_models_of_this_code: sk.count } } : {}),
    },
    awards: {
      award_winning: p.award_winning,
      list: (p.awards ?? []).map((a) => ({ program: a.program_en ?? a.program, year: a.year, level_en: a.level_en, level_ru: a.level_ru, source: a.href })),
    },
    certification: {
      certified: p.cert !== null && p.cert !== undefined,
      note: p.cert
        ? 'Covered by the brand\'s EAEU serial certification (every unit of the article, not a batch). Details: https://vargov.ru/en/certification'
        : 'Not in the list of certified articles of the dataset snapshot. Details: https://vargov.ru/en/certification',
    },
    configurator,
    elements_in_stock: 'Stock changes four times a day; see https://vargov.ru/en/in-stock',
    not_published: 'No price, no materials and no composition dimensions are published: every composition is made to order and scaled to the room. Quotes come per request (info@vargov.ru, WhatsApp +7 916 537 33 52, Telegram @AntonVargov).',
    supply_and_installation: dealerRouteLine('en'),
  };
}

// ---------------------------------------------------------------------------------------------
// build_configurator_link

export interface LinkParams {
  code: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  ceilingMm?: number;
  lang?: Lang;
  openOnFormStep?: boolean;
}

export interface LinkError {
  error: string;
  code?: string;
  product_page?: string;
}

/** The configurator does not build a plan smaller than 300 × 300 mm (link-keys contract, memory of the configurator's author, 25.09.2026). */
export const PLAN_MIN_MM = 300;
/** Sanity ceiling of this server, not a rule of the configurator. */
const MM_SANITY_MAX = 50_000;

function intMm(name: string, v: number | undefined, min: number): number | undefined | LinkError {
  if (v === undefined || v === null) return undefined;
  if (!Number.isFinite(v) || !Number.isInteger(v)) return { error: `${name} must be an integer number of millimetres (the configurator reads integer mm only)` };
  if (v < min) return { error: `${name} must be at least ${min} mm` + (min === PLAN_MIN_MM ? ' — the configurator does not build a plan smaller than 300 × 300 mm' : '') };
  if (v > MM_SANITY_MAX) return { error: `${name} exceeds ${MM_SANITY_MAX} mm — check the units (millimetres expected)` };
  return v;
}

export function buildConfiguratorLink(params: LinkParams): { url: string; code: string; lang: Lang; keys: Record<string, string>; notes: string[] } | LinkError {
  const d = getData();
  const code = normalizeCode(params.code);
  const e = d.byCode.get(code);
  const lang: Lang = params.lang && LANGS.includes(params.lang) ? params.lang : 'en';
  if (!d.openSet.has(code)) {
    return {
      error: e
        ? `${code} is calculated individually: the configurator does not open it with a calculation (360 of 605 compositions do). A link with ?sku=${code} would only open the showcase. Use the product page and contact the brand for a calculation.`
        : `${code} is not a code of the Vargov®Design catalogue (LC0001…LC0602, some with a -1/-2 suffix). Use search_compositions to find the code.`,
      code,
      ...(e ? { product_page: e.p.urls?.[lang] ?? sitePage(code, lang) } : {}),
    };
  }

  const w = intMm('lengthMm', params.lengthMm, PLAN_MIN_MM);
  const l = intMm('widthMm', params.widthMm, PLAN_MIN_MM);
  const h = intMm('heightMm', params.heightMm, 1);
  const ceil = intMm('ceilingMm', params.ceilingMm, 1);
  for (const v of [w, l, h, ceil]) if (v && typeof v === 'object') return v;

  const q = new URLSearchParams();
  const keys: Record<string, string> = {};
  q.set('sku', code);
  keys.sku = 'article code';
  if (typeof w === 'number') {
    q.set('w', String(w));
    keys.w = 'the "Length" field of the plan, mm (the letter is misleading: w = Length)';
  }
  if (typeof l === 'number') {
    q.set('l', String(l));
    keys.l = 'the "Width" field of the plan, mm (l = Width)';
  }
  if (typeof h === 'number') {
    q.set('h', String(h));
    keys.h = 'height of the cloud of elements, mm (for a ribbon: the composition height)';
  }
  if (typeof ceil === 'number') {
    q.set('ceil', String(ceil));
    keys.ceil = 'room ceiling height, mm (default 2700): goes into the IFC4 file and AR, does not change the layout';
  }
  q.set('lang', lang);
  keys.lang = 'interface language';
  if (params.openOnFormStep) {
    q.set('step', 'form');
    keys.step = 'form — opens the page scrolled to the "Composition form" step';
  }

  const host = lang === 'ru' ? CONFIGURATOR_RU : CONFIGURATOR_INTL;
  const notes = [
    lang === 'ru'
      ? 'Russian interface: the Russian copy configurator.vargov.ru; the same query works on vargov.design.'
      : 'Visitors from Russia are redirected from vargov.design to configurator.vargov.ru with the same query.',
    'All dimensions are integer millimetres. The plan Length × Width is the zone the composition is laid out in, not a product size; the composition is scaled to it.',
    'Element sizes, colours and the composition form are chosen in the configurator; its "Share" button then copies a link that reopens the exact same calculation (the address bar does not reflect the state).',
    ...kindNotes(code, d.byCode.get(code)?.kind ?? null),
  ];
  return { url: host + '?' + q.toString(), code, lang, keys, notes };
}

export function isLinkError(x: unknown): x is LinkError {
  return !!x && typeof x === 'object' && 'error' in (x as Record<string, unknown>);
}

function linkUrl(code: string, lang: Lang): string | null {
  const r = buildConfiguratorLink({ code, lang });
  return isLinkError(r) ? null : r.url;
}

export { FAMILIES };
