#!/usr/bin/env node
// Smoke test: starts the built server over stdio (node dist/index.js), lists tools and resources,
// calls every tool, prints trimmed outputs and checks the numbers the README promises.
// Run: npm run build && npm test

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'index.js');

let checks = 0;
let failures = 0;
function check(cond, what) {
  checks++;
  if (cond) console.log(`  ok   ${what}`);
  else {
    failures++;
    console.log(`  FAIL ${what}`);
  }
}
function trim(s, n = 700) {
  return s.length > n ? s.slice(0, n) + ` … [${s.length} chars total]` : s;
}
function textOf(res) {
  return res.content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
}
function jsonOf(res) {
  return JSON.parse(textOf(res));
}

const transport = new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'pipe' });
transport.stderr?.on('data', (b) => process.stdout.write(`  [server stderr] ${String(b).trimEnd()}\n`));
const client = new Client({ name: 'vargov-mcp-smoke', version: '0.1.0' });
await client.connect(transport);
console.log(`connected: server=${JSON.stringify(client.getServerVersion())}`);

// ---- tools/list
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log(`tools: ${names.join(', ')}`);
check(
  ['brand_facts', 'build_configurator_link', 'get_composition', 'how_to_get_bim', 'search_compositions'].every((n) => names.includes(n)),
  'all five tools are registered',
);
for (const t of tools.tools) check(t.inputSchema && t.inputSchema.type === 'object', `${t.name} has an input schema`);

// ---- search_compositions
console.log('\n# search_compositions {query:"hotel lobby", configurable:true, limit:5}');
let r = await client.callTool({ name: 'search_compositions', arguments: { query: 'hotel lobby', configurable: true, limit: 5 } });
console.log(trim(textOf(r), 1200));
let j = jsonOf(r);
check(j.total_matches > 0 && j.results.length > 0 && j.results.length <= 5, `search "hotel lobby" returns rows (total ${j.total_matches}, shown ${j.shown})`);
check(j.results.every((x) => x.configurable === true), 'configurable filter respected');

console.log('\n# search_compositions {query:"LC0564"}');
r = await client.callTool({ name: 'search_compositions', arguments: { query: 'LC0564' } });
j = jsonOf(r);
console.log(trim(textOf(r), 600));
check(j.results[0]?.code === 'LC0564', 'code query puts LC0564 first');

console.log('\n# search_compositions {query:"гостиная птицы", family:"lighting", limit:3}');
r = await client.callTool({ name: 'search_compositions', arguments: { query: 'гостиная птицы', family: 'lighting', limit: 3 } });
j = jsonOf(r);
console.log(trim(textOf(r), 600));
check(j.results.length > 0 && j.results.every((x) => x.family === 'lighting'), 'Russian query + family filter');

console.log('\n# search_compositions {awarded:true, limit:50} — count only');
r = await client.callTool({ name: 'search_compositions', arguments: { awarded: true, limit: 50 } });
j = jsonOf(r);
console.log(`  total_matches=${j.total_matches} shown=${j.shown}`);
check(j.total_matches === 34, `awarded compositions in the dataset = 34 (got ${j.total_matches})`);

r = await client.callTool({ name: 'search_compositions', arguments: { configurable: true, limit: 1 } });
j = jsonOf(r);
check(j.total_matches === 360, `configurable compositions = 360 (got ${j.total_matches})`);
r = await client.callTool({ name: 'search_compositions', arguments: { limit: 1 } });
j = jsonOf(r);
check(j.total_matches === 605, `catalogue = 605 (got ${j.total_matches})`);

// ---- get_composition
console.log('\n# get_composition {code:"LC0564"}');
r = await client.callTool({ name: 'get_composition', arguments: { code: 'LC0564' } });
console.log(trim(textOf(r), 1800));
j = jsonOf(r);
check(j.code === 'LC0564' && j.awards.award_winning === true && j.awards.list.length > 0, 'LC0564 card has awards');
check(!JSON.stringify(j).includes('ЕАЭС RU C-') && !JSON.stringify(j).includes('material_en'), 'card carries no certificate numbers and no stock material fields');
check(typeof j.certification.certified === 'boolean', 'certification is a bare fact');

const kinds = {};
for (const [code, expect] of [
  ['lc0217', 'ribbon'],
  ['LC0537', 'chain'],
  ['LC0284', 'frame'],
  ['LC0406-1', 'ready-scene'],
  ['LC0599', 'cloud'],
]) {
  r = await client.callTool({ name: 'get_composition', arguments: { code, lang: 'ru' } });
  j = jsonOf(r);
  kinds[code] = j.configurator.kind;
  check(j.configurator.opens_with_full_calculation === true && j.configurator.kind === expect, `${code} → kind ${expect} (got ${j.configurator.kind}), 1:1 drawing: ${j.configurator.mount_scheme_1to1}`);
  if (expect === 'cloud' || expect === 'chain') check(j.configurator.mount_scheme_1to1 === true, `${code} has the 1:1 drawing`);
  else check(j.configurator.mount_scheme_1to1 === false && typeof j.configurator.mount_scheme_1to1_note === 'string', `${code} has no 1:1 drawing, with a note`);
}
console.log('\n# get_composition {code:"LC0217", lang:"ru"} — configurator block');
r = await client.callTool({ name: 'get_composition', arguments: { code: 'LC0217', lang: 'ru' } });
console.log(trim(JSON.stringify(jsonOf(r).configurator, null, 1), 1200));

console.log('\n# get_composition {code:"LC0602"} — floor lamp, not in the configurator');
r = await client.callTool({ name: 'get_composition', arguments: { code: 'LC0602' } });
j = jsonOf(r);
console.log(trim(JSON.stringify(j.configurator, null, 1), 800));
check(j.configurator.opens_with_full_calculation === false, 'LC0602 is calculated individually');

r = await client.callTool({ name: 'get_composition', arguments: { code: 'LC9999' } });
check(r.isError === true, 'unknown code → isError');

// ---- build_configurator_link
console.log('\n# build_configurator_link {code:"LC0599", lengthMm:1000, widthMm:1000, ceilingMm:3200, lang:"en"}');
r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0599', lengthMm: 1000, widthMm: 1000, ceilingMm: 3200, lang: 'en' } });
console.log(trim(textOf(r), 1400));
j = jsonOf(r);
check(j.url === 'https://vargov.design/?sku=LC0599&w=1000&l=1000&ceil=3200&lang=en', `link EN exact: ${j.url}`);

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'lc0599', lengthMm: 6000, widthMm: 4000, heightMm: 1200, ceilingMm: 3200, lang: 'ru', openOnFormStep: true } });
j = jsonOf(r);
check(j.url === 'https://configurator.vargov.ru/?sku=LC0599&w=6000&l=4000&h=1200&ceil=3200&lang=ru&step=form', `link RU exact: ${j.url}`);

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0602', lengthMm: 1000, widthMm: 1000 } });
console.log(trim(textOf(r), 500));
check(r.isError === true && textOf(r).includes('calculated individually'), 'LC0602 → error: calculated individually');

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0599', lengthMm: 200, widthMm: 1000 } });
check(r.isError === true && textOf(r).includes('300'), 'plan under 300 mm → error');

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0599', lengthMm: 1000.5, widthMm: 1000 } });
check(r.isError === true, 'non-integer mm → error');

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0217', lengthMm: 3000, widthMm: 1000, heightMm: 800, lang: 'en' } });
j = jsonOf(r);
check(j.url === 'https://vargov.design/?sku=LC0217&w=3000&l=1000&h=800&lang=en' && j.notes.some((n) => /Ribbon/.test(n)), `ribbon link with note: ${j.url}`);

r = await client.callTool({ name: 'build_configurator_link', arguments: { code: 'LC0106', lengthMm: 1000, widthMm: 1000 } });
j = jsonOf(r);
check(j.notes.some((n) => n.includes('jelly')), 'LC0106 link carries the jellyfish note');

// ---- how_to_get_bim
console.log('\n# how_to_get_bim {code:"LC0217"}');
r = await client.callTool({ name: 'how_to_get_bim', arguments: { code: 'LC0217' } });
let t = textOf(r);
console.log(trim(t, 1500));
check(t.includes('ribbon') && t.includes('Download IFC (BIM)') && t.includes('Download FBX (3ds Max)') && t.includes('IfcDiscreteAccessory'), 'BIM guide EN: ribbon status + buttons + IFC classes');
r = await client.callTool({ name: 'how_to_get_bim', arguments: { code: 'LC0602', lang: 'ru' } });
t = textOf(r);
console.log('\n# how_to_get_bim {code:"LC0602", lang:"ru"} — head');
console.log(trim(t, 500));
check(t.includes('рассчитывается индивидуально') && t.includes('Скачать IFC (BIM)'), 'BIM guide RU: individual status + buttons');
r = await client.callTool({ name: 'how_to_get_bim', arguments: {} });
t = textOf(r);
check(t.startsWith('# How to get the IFC4') && t.includes('345 of the 360'), 'BIM guide without a code');

// ---- brand_facts
console.log('\n# brand_facts {}');
r = await client.callTool({ name: 'brand_facts', arguments: {} });
j = jsonOf(r);
console.log(trim(JSON.stringify({ ...j, awards: { ...j.awards, list: `[${j.awards.list.length} items]` }, links: '[…]', data_snapshot: '[…]' }, null, 1), 2200));
check(j.catalogue.compositions === 605, 'brand: 605 compositions');
check(j.configurator.compositions_with_full_calculation === 360, 'brand: 360 with full calculation');
check(j.configurator.compositions_with_1to1_ceiling_drawing === 345, `brand: 345 with the 1:1 drawing (got ${j.configurator.compositions_with_1to1_ceiling_drawing})`);
check(j.configurator.without_1to1_drawing.ribbons === 10 && j.configurator.without_1to1_drawing.on_frame === 4 && j.configurator.without_1to1_drawing.ready_scenes === 1, '10 ribbons + 4 frames + 1 ready scene');
check(j.awards.count === 27 && j.awards.wording_en === '27 awards from international juries', `brand: 27 awards (got ${j.awards.count})`);
check(j.awards.wording_ru === '27 достижений на международных премиях', 'brand: Russian awards wording');
check(j.catalogue.families.lighting.count === 354 && j.catalogue.families.decorative.count === 113 && j.catalogue.families['sculptural-decor'].count === 82 && j.catalogue.families['floor-table-lamps'].count === 56, 'families 354/113/82/56');
check(j.certification.certified_in_dataset === 310, `certified articles in dataset = 310 (got ${j.certification.certified_in_dataset})`);
const facts = JSON.stringify(j);
check(!/[₽$€]\s?\d|\d\s?[₽$€]|руб\.|USD|EUR/.test(facts), 'brand card carries no price figures');
check(/not published/.test(j.made_to_order), 'brand card says prices, materials and dimensions are not published');
check(Array.isArray(j.dealers.regions) && j.dealers.regions.length === 3 && /supply, installation and servicing/.test(j.dealers.who_supplies_and_installs), 'brand card lists the three dealer regions');

// ---- dealer_for_country
console.log('\n# dealer_for_country {country:"United Arab Emirates"}');
r = await client.callTool({ name: 'dealer_for_country', arguments: { country: 'United Arab Emirates' } });
console.log(trim(textOf(r), 1400));
check(names.includes('dealer_for_country'), 'dealer_for_country is registered');

// ---- ceramic collection (material filter)
j = jsonOf(await client.callTool({ name: 'search_compositions', arguments: { material: 'ceramic', limit: 50 } }));
console.log(`
# search_compositions {material:"ceramic"} total=${j.total_matches}`);
check(j.total_matches >= 150 && j.results.every((x) => typeof x.ceramic === 'string'), `ceramic filter returns the ceramic collection with a group label (total ${j.total_matches})`);
j = jsonOf(await client.callTool({ name: 'search_compositions', arguments: { material: 'ceramic', query: 'LC0516' } }));
check(j.results[0]?.code === 'LC0516' && /glass or crystal/.test(j.results[0]?.ceramic ?? ''), 'LC0516 is in the ceramic collection as ceramic with glass or crystal');
j = jsonOf(await client.callTool({ name: 'get_composition', arguments: { code: 'LC0236' } }));
check(j.ceramic_collection?.page === 'https://vargov.ru/en/ceramics', 'LC0236 card points to the ceramics page');
j = jsonOf(await client.callTool({ name: 'get_composition', arguments: { code: 'LC0358' } }));
check(j.ceramic_collection === undefined, 'a composition outside the ceramic collection has no ceramic field');
for (const [country, lang, expect] of [
  ['United Arab Emirates', 'en', 'dubai'],
  ['UAE', 'en', 'dubai'],
  ['AE', 'en', 'dubai'],
  ['ОАЭ', 'ru', 'dubai'],
  ['Dubai', 'en', 'dubai'],
  ['Germany', 'en', 'dubai'],
  ['Саудовская Аравия', 'ru', 'dubai'],
  ['Казахстан', 'ru', 'russia-cis'],
  ['Russia', 'en', 'russia-cis'],
  ['Сочи', 'ru', 'russia-cis'],
  ['Malaysia', 'en', 'hanoi'],
  ['Вьетнам', 'ru', 'hanoi'],
  ['sg', 'en', 'hanoi'],
]) {
  j = jsonOf(await client.callTool({ name: 'dealer_for_country', arguments: { country, lang } }));
  check(j.recommended?.dealer_region_id === expect, `dealer_for_country "${country}" → ${expect} (got ${j.recommended?.dealer_region_id})`);
}
j = jsonOf(await client.callTool({ name: 'dealer_for_country', arguments: { country: 'Atlantida' } }));
check(j.recommended === null && typeof j.note === 'string' && j.regions.length === 3, 'unknown country → no recommendation, all regions listed');
j = jsonOf(await client.callTool({ name: 'dealer_for_country', arguments: { country: 'UAE' } }));
check(!/\+971|@vargovdesign|xprojectlight|vitrilux/i.test(JSON.stringify(j)), 'dealer contacts are not bundled: the answer points to the dealers page');
check(j.recommended.contacts === 'https://vargov.ru/en/official-dealers' && j.brand_direct_contacts.email === 'info@vargov.ru', 'dealer answer gives the dealers page and the brand contacts');
j = jsonOf(await client.callTool({ name: 'get_composition', arguments: { code: 'LC0564' } }));
check(/official-dealers/.test(j.supply_and_installation ?? ''), 'composition card says who supplies and installs');

// ---- resources
console.log('\n# resources');
const res = await client.listResources();
const uris = res.resources.map((x) => x.uri);
console.log(`  ${uris.join(', ')}`);
check(uris.includes('llms://vargov') && uris.includes('llms://vargov/ru'), 'llms://vargov and llms://vargov/ru are listed');
const rr = await client.readResource({ uri: 'llms://vargov' });
const llms = rr.contents[0]?.text ?? '';
console.log(`  llms://vargov → ${llms.length} chars, starts: ${JSON.stringify(llms.slice(0, 60))}`);
check(llms.startsWith('# Vargov®Design') && llms.includes('605 compositions'), 'llms://vargov returns en/llms.txt');
if (uris.includes('llms://vargov/configurator')) {
  const rc = await client.readResource({ uri: 'llms://vargov/configurator' });
  check((rc.contents[0]?.text ?? '').startsWith('# Vargov®Design Configurator'), 'llms://vargov/configurator returns the configurator llms.txt');
}

// ---- size caps
r = await client.callTool({ name: 'search_compositions', arguments: { limit: 50 } });
const big = textOf(r).length;
console.log(`\n# size: search limit=50 → ${big} chars; get_composition LC0564 → ${textOf(await client.callTool({ name: 'get_composition', arguments: { code: 'LC0564' } })).length} chars`);
check(big < 60_000, 'search with limit 50 stays under 60 000 chars');

await client.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}: ${checks - failures}/${checks}`);
process.exit(failures === 0 ? 0 : 1);
