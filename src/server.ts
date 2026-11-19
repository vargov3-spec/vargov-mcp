// Registers the tools and resources on an McpServer. Transport is chosen by index.ts.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bimGuide } from './bim.js';
import { brandFacts } from './brand.js';
import { dealerForCountry } from './dealers.js';
import { SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX, buildConfiguratorLink, compositionCard, isLinkError, searchCompositions } from './catalog.js';
import { FAMILIES, LANGS, getData } from './data.js';

export const SERVER_NAME = 'vargov-design';
export const SERVER_VERSION = '0.2.0';

const LangSchema = z.enum(LANGS);

function textResult(payload: unknown, isError = false) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 1);
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) };
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Vargov®Design: 605 made-to-order light and decorative compositions (codes LC0001…LC0602). ' +
        'Use search_compositions to find candidates for a room, get_composition for the card, build_configurator_link to open the 3D configurator with the plan dimensions and ceiling height, how_to_get_bim for the IFC4/FBX steps, brand_facts for the brand card, dealer_for_country for who supplies and installs in a given country. ' +
        'The brand publishes no prices, no materials and no composition dimensions: every composition is scaled to the room; quotes come per request. All data is bundled; the server makes no network calls.',
    },
  );

  server.registerTool(
    'search_compositions',
    {
      title: 'Search Vargov®Design compositions',
      description:
        'Search the Vargov®Design catalogue: 605 made-to-order light and decorative compositions, codes LC0001…LC0602. ' +
        'Full-text over codes, type labels and the brand\'s own texts (description, where it works, style) in Russian and English; other site languages are matched too. ' +
        'Filters: family (lighting | decorative | sculptural-decor | floor-table-lamps); lit (true = the lighting family or a type label mentioning light/lamp/backlit — a hint derived from labels, not a measured property); ' +
        'awarded (has a listed award); configurable (opens in the 3D configurator with a full calculation: IFC4, FBX, PDF specification, tender sheet — 360 of 605). ' +
        'Returns compact rows: code, names RU/EN, family, type, flags, site pages, cover image, English snippet. ' +
        'Then use get_composition for details and build_configurator_link to open the configurator with the room plan. No prices, materials or composition dimensions are published.',
      inputSchema: {
        query: z.string().max(300).optional().describe('Words or a code, e.g. "hotel lobby", "birds", "гостиная", "LC0564"'),
        family: z.enum(FAMILIES).optional(),
        lit: z.boolean().optional().describe('true: light-emitting (hint from labels); false: decorative/unlit'),
        awarded: z.boolean().optional(),
        configurable: z.boolean().optional().describe('true: opens in the configurator with a full calculation (IFC4/FBX/PDF/tender sheet)'),
        limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional().describe(`default ${SEARCH_LIMIT_DEFAULT}, max ${SEARCH_LIMIT_MAX}`),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => textResult(searchCompositions(args)),
  );

  server.registerTool(
    'get_composition',
    {
      title: 'Composition card',
      description:
        'Everything the public dataset knows about one composition by its code (LC0564, lc0564, "564" are all accepted): names RU/EN, family and type, the brand\'s texts in the requested language (default en; ru de it fr es vi ar available), ' +
        'site pages in 8 languages, cover image, 3D models (3ddd/3dsky, Sketchfab), awards, whether it is certified (fact only), ' +
        'and the configurator status: opens with a full calculation or is calculated individually; kind (cloud of elements / ribbon / chain / on a frame / ready scene); IFC4, FBX, PDF and tender-sheet exports; whether the 1:1 ceiling drawing exists; ready links. ' +
        'No price, no materials, no composition dimensions — they are not published.',
      inputSchema: {
        code: z.string().min(1).max(20).describe('Catalogue code, e.g. LC0564 or LC0406-1'),
        lang: LangSchema.optional().describe('Language of the texts, default en'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ code, lang }) => {
      const card = compositionCard(code, lang ?? 'en');
      if (!card) return textResult({ error: `Code "${code}" is not in the catalogue (LC0001…LC0602, some with a -1/-2 suffix). Use search_compositions.` }, true);
      return textResult(card);
    },
  );

  server.registerTool(
    'build_configurator_link',
    {
      title: 'Configurator link with room dimensions',
      description:
        'Builds a link that opens the Vargov®Design 3D configurator on a composition with the plan dimensions and the room ceiling height already filled in. ' +
        'Only codes that open with a full calculation are accepted (360 of 605; others return an error with the product page). ' +
        'lengthMm → the "Length" field of the plan, widthMm → the "Width" field, both integer millimetres, at least 300 (the plan is the zone the composition is laid out in, not a product size); ' +
        'heightMm → height of the cloud of elements (optional); ceilingMm → room ceiling height (optional, default 2700 in the configurator; it goes into the IFC4 file and AR); ' +
        'lang → interface language (ru opens configurator.vargov.ru, other languages vargov.design); openOnFormStep → open scrolled to the "Composition form" step. ' +
        'The visitor then picks element sizes, colours and the form; the configurator\'s "Share" button returns a link that reopens that exact calculation.',
      inputSchema: {
        code: z.string().min(1).max(20),
        lengthMm: z.number().optional().describe('Plan length, integer mm, ≥ 300'),
        widthMm: z.number().optional().describe('Plan width, integer mm, ≥ 300'),
        heightMm: z.number().optional().describe('Height of the cloud of elements, integer mm (optional)'),
        ceilingMm: z.number().optional().describe('Room ceiling height, integer mm (optional; configurator default 2700)'),
        lang: LangSchema.optional().describe('ru en de it fr es vi ar; default en'),
        openOnFormStep: z.boolean().optional().describe('true: add step=form to open scrolled to the form step'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const r = buildConfiguratorLink(args);
      return isLinkError(r) ? textResult(r, true) : textResult(r);
    },
  );

  server.registerTool(
    'how_to_get_bim',
    {
      title: 'How to get IFC4 (BIM) and FBX',
      description:
        'Step-by-step: where the "Download IFC (BIM)" and "Download FBX (3ds Max)" buttons are (step "3D composition scheme" → "Documents" drawer), what the IFC4 and FBX files contain and what they do not (no textures/UV, BIM properties only in IFC4, ceiling fixing points as IfcDiscreteAccessory objects), ' +
        'and when the 1:1 ceiling drawing opens (only after the production brief is started in production). With a code, the answer starts with the status of that composition (full calculation / calculated individually; ribbon, chain, frame, ready scene). Text in English or Russian.',
      inputSchema: {
        code: z.string().max(20).optional().describe('Optional catalogue code to prefix the guide with that composition\'s status'),
        lang: z.enum(['en', 'ru']).optional().describe('en (default) or ru'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ code, lang }) => textResult(bimGuide(code, lang ?? 'en')),
  );

  server.registerTool(
    'brand_facts',
    {
      title: 'Brand card',
      description:
        'Compact card of Vargov®Design: founder and founding year, catalogue size and families, configurator scope (full calculation, 1:1 drawing), the awards count and list, certification, trademarks, showroom, contacts, dealers page, site languages, links to llms.txt of the site, the knowledge base and the configurator, the open dataset on Hugging Face. Numbers are computed from the bundled data.',
      inputSchema: { lang: z.enum(['en', 'ru']).optional().describe('en (default) or ru for the wording fields') },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ lang }) => textResult(brandFacts(lang ?? 'en')),
  );

  server.registerTool(
    'dealer_for_country',
    {
      title: 'Official dealer for a country',
      description:
        'Who supplies, installs and services Vargov®Design compositions in a given country: the official dealer of that region (Moscow — Russia and the CIS; Hanoi — Vietnam, Laos, Cambodia, Thailand, Malaysia, Singapore; Dubai — the Persian Gulf, Middle East, Americas, Europe, Asia, Africa and every other country), ' +
        'the page with the dealer contacts, the brand\'s direct contacts, and the installation terms as published (a separate service priced individually; supervised installation available). ' +
        'country: a country name in English or Russian, an ISO 3166 alpha-2 code, or a major city (Dubai, Moscow, Hanoi…). Without country, returns all three regions.',
      inputSchema: {
        country: z.string().max(80).optional().describe('e.g. "United Arab Emirates", "UAE", "AE", "ОАЭ", "Dubai", "Казахстан"'),
        lang: z.enum(['en', 'ru']).optional().describe('en (default) or ru'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ country, lang }) => textResult(dealerForCountry(country, lang ?? 'en')),
  );

  const d = getData();
  server.registerResource(
    'llms-vargov-en',
    'llms://vargov',
    { title: 'Vargov®Design llms.txt (English)', description: 'en/llms.txt of the public knowledge base vargov3-spec/vargov-ai-kb: brand facts, catalogue, configurator, awards, contacts.', mimeType: 'text/plain' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: d.llmsEn }] }),
  );
  server.registerResource(
    'llms-vargov-ru',
    'llms://vargov/ru',
    { title: 'Vargov®Design llms.txt (Russian)', description: 'llms.txt of the public knowledge base, Russian.', mimeType: 'text/plain' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: d.llmsRu }] }),
  );
  if (d.llmsConfigurator) {
    server.registerResource(
      'llms-vargov-configurator',
      'llms://vargov/configurator',
      { title: 'Vargov®Design configurator llms.txt', description: 'llms.txt of the 3D configurator (vargov.design): what it is, what it exports, which pages are open.', mimeType: 'text/plain' },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/plain', text: d.llmsConfigurator ?? '' }] }),
    );
  }

  return server;
}
