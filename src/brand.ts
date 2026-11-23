// brand_facts: a compact card of the brand. Numbers are computed from the bundled data
// (products.json, open-skus.json, organization.jsonld) so that they can be checked, not typed in.

import { bimCounts } from './bim.js';
import { CONFIGURATOR_INTL, CONFIGURATOR_RU, SITE } from './catalog.js';
import { FAMILIES, getData, type Lang } from './data.js';
import { dealerForCountry } from './dealers.js';

const FAMILY_PAGES: Record<string, string> = {
  lighting: 'lighting',
  decorative: 'decorative',
  'sculptural-decor': 'sculptural-decor',
  'floor-table-lamps': 'floor-table-lamps',
};

export function brandFacts(lang: Lang = 'en') {
  const d = getData();
  const org = d.organization;
  const person = d.person;
  const store = d.store;
  const counts = bimCounts();
  const ru = lang === 'ru';

  const families = Object.fromEntries(
    FAMILIES.map((f) => {
      const items = d.products.filter((p) => p.category === f);
      const label = items[0]?.category_label ?? { ru: f, en: f };
      return [f, { count: items.length, label_ru: label.ru, label_en: label.en, page_ru: `${SITE}/${FAMILY_PAGES[f]}`, page_en: `${SITE}/en/${FAMILY_PAGES[f]}` }];
    }),
  );

  const codes = d.products.map((p) => p.code).sort();
  const awards = org?.award ?? [];
  const awardsCount = awards.length;

  // If the knowledge base ships references/brand-facts.json, pass it through under its own key — minus the
  // `forbidden` wordings: they exist for the knowledge base's own checker, and an assistant reading them
  // here could repeat the very phrases they forbid.
  const extra = d.brandFacts ? { brand_facts_file: withoutKey(d.brandFacts, 'forbidden') } : {};

  return {
    name: org?.name ?? 'Vargov®Design',
    alternate_names: org?.alternateName ?? ['Vargov Design', 'VARGOV'],
    description: org?.description,
    founded: org?.foundingDate,
    founder: person ? { name: person.name, name_ru: person.alternateName, title: person.jobTitle, page: person.url, links: person.sameAs } : undefined,
    made_to_order: ru
      ? 'Каждая композиция собирается под конкретный интерьер: масштаб и геометрия подстраиваются под пространство. Цены и размеры композиций не публикуются, стоимость — по заявке; материалы публикуются только для керамической коллекции (vargov.ru/ceramics).'
      : 'Every composition is assembled for a specific interior; its scale and geometry are adjusted to the space. Prices and composition dimensions are not published, a quote comes per request; materials are published only for the ceramic collection (vargov.ru/en/ceramics).',
    catalogue: {
      compositions: d.products.length,
      code_range: `${codes[0]}…${codes[codes.length - 1]}`,
      families,
      page_ru: `${SITE}/catalog`,
      page_en: `${SITE}/en/catalog`,
      product_page_pattern: `${SITE}/en/catalog/<code in lower case>  (Russian: ${SITE}/catalog/<code>)`,
    },
    configurator: {
      url_international: CONFIGURATOR_INTL,
      url_russian: CONFIGURATOR_RU,
      compositions_with_full_calculation: counts.open,
      compositions_with_1to1_ceiling_drawing: counts.withScheme,
      without_1to1_drawing: { ribbons: counts.ribbons, on_frame: counts.frames, ready_scenes: counts.readyScenes },
      exports_by_the_visitor: ['IFC4 model (BIM)', 'FBX model (3ds Max)', 'PDF specification', 'tender sheet'],
      production_brief: ru ? `${SITE}/specifications` : `${SITE}/en/specifications`,
      llms: 'https://vargov.design/llms.txt',
      ifc4_page: ru ? `${SITE}/configurator/ifc4` : `${SITE}/en/configurator/ifc4`,
      fbx_page: ru ? `${SITE}/configurator/fbx` : `${SITE}/en/configurator/fbx`,
    },
    awards: {
      count: awardsCount,
      wording_en: `${awardsCount} awards from international juries`,
      wording_ru: `${awardsCount} достижений на международных премиях`,
      note: ru
        ? 'Среди них — номинация Awwwards 2026 за 3D-конфигуратор (номинация, не победа) и членство Антона Варгова в High Jury премии ADD Awards 2024.'
        : 'Among them: an Awwwards 2026 nomination for the 3D configurator (a nomination, not a win) and Anton Vargov\'s High Jury membership at ADD Awards 2024.',
      page: ru ? `${SITE}/awards` : `${SITE}/en/awards`,
      verified_list: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/knowledge/awards-verified.md',
      list: awards,
    },
    certification: {
      summary: ru
        ? 'Два серийных сертификата ТР ЕАЭС (ТР ТС 004/2011, 020/2011) и две декларации ТР ЕАЭС 037/2016 на 310 артикулов LC, знак EAC, действуют до 2031 года; сертификат серийный — покрывает каждое изделие артикула, а не партию.'
        : 'Two EAEU serial certificates (TR CU 004/2011, 020/2011) and two TR EAEU 037/2016 declarations covering 310 LC articles, EAC mark, valid until 2031; serial scope means every unit of a listed article is covered, not a single batch.',
      page: ru ? `${SITE}/certification` : `${SITE}/en/certification`,
      certified_in_dataset: d.products.filter((p) => p.cert).length,
    },
    trademarks: org?.identifier?.map((i) => ({ registry: i.propertyID, number: i.value, url: i.url })),
    showroom: store
      ? {
          name: store.name,
          address: store.address ? `${store.address.streetAddress}, ${store.address.addressLocality}, ${store.address.postalCode ?? ''} ${store.address.addressCountry}`.trim() : undefined,
          address_en: '24 Nakhimovsky Prospekt, bldg. 1, Pavilion 2, Stand 212, Moscow',
          hours: store.openingHoursSpecification?.map((h) => `${h.dayOfWeek.length === 7 ? 'daily' : h.dayOfWeek.join(', ')} ${h.opens}–${h.closes}`),
          telephone: store.telephone,
          page: ru ? `${SITE}/showroom` : `${SITE}/en/showroom`,
          maps: store.hasMap,
        }
      : undefined,
    contacts: {
      email: org?.email,
      whatsapp: org?.telephone,
      telegram_requests: '@AntonVargov (https://t.me/AntonVargov)',
      telegram_channel: '@vargov_design (https://t.me/vargov_design)',
    },
    dealers: {
      who_supplies_and_installs: dealerForCountry(undefined, lang).who_supplies_and_installs,
      regions: dealerForCountry(undefined, lang).regions,
      by_country: 'dealer_for_country tool: the regional dealer for a country (name in English or Russian, or ISO code)',
      official_dealers_page: ru ? `${SITE}/official-dealers` : `${SITE}/en/official-dealers`,
      installations_page: ru ? `${SITE}/official-dealers` : `${SITE}/en/official-dealers`,
      installations_list: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/knowledge/installations.md',
    },
    // «Защита проекта» (владелец 23.11.2026: «добавить в ИИ только без информации по процентам»; текст утверждён).
    // Только что это и где вход: условия портала (вознаграждение, выплаты, правила) — внутренние, их здесь нет.
    designers_portal: {
      name: ru ? 'Защита проекта' : 'Project protection',
      url: 'https://pro.vargov.ru',
      summary: ru
        ? 'Закрытый портал Vargov®Design для дизайнеров интерьера и архитекторов: специалист закрепляет за собой объект, в который предлагает композиции Vargov®Design. Доступ — по запросу на странице входа портала; условия сотрудничества видны только внутри портала, после входа.'
        : 'A private Vargov®Design portal for interior designers and architects: a specialist registers the project in which they propose Vargov®Design compositions. Access is on request from the portal\'s sign-in page; the terms of cooperation are shown only inside the portal, after sign-in.',
    },
    languages: {
      site: ['ru', 'en', 'de', 'it', 'fr', 'es', 'vi', 'ar'],
      site_pattern: `${SITE}/<lang>/…  (Russian at the root, English at /en)`,
      knowledge_base_only: ['zh'],
      production_brief: ['ru', 'en'],
    },
    links: {
      site: SITE,
      site_llms: `${SITE}/llms.txt`,
      knowledge_base: 'https://github.com/vargov3-spec/vargov-ai-kb',
      knowledge_base_llms_en: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/en/llms.txt',
      knowledge_base_llms_ru: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/llms.txt',
      configurator_llms: 'https://vargov.design/llms.txt',
      dataset_huggingface: 'https://huggingface.co/datasets/vargov-design/vargov-design-catalog',
      dataset_json: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/datasets/products.json',
      catalog_jsonld: 'https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/references/catalog.jsonld',
      press_kit: ru ? `${SITE}/press` : `${SITE}/en/press`,
      social: org?.sameAs,
    },
    data_snapshot: d.manifest ? { updated_at: d.manifest.updated_at, files: d.manifest.files?.map((f) => ({ file: f.file, sha256: f.sha256.slice(0, 16) })) } : undefined,
    licence: 'Data: CC BY 4.0 (Vargov®Design). Server code: MIT.',
    ...extra,
  };
}

/** Deep copy of a JSON value with every property named `key` removed at any depth. */
function withoutKey(value: unknown, key: string): unknown {
  if (Array.isArray(value)) return value.map((v) => withoutKey(v, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key).map(([k, v]) => [k, withoutKey(v, key)]));
  }
  return value;
}
