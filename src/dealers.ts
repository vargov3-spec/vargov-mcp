// dealer_for_country: which official dealer handles supply and installation for a given country.
//
// Regions and wording follow the answers published on vargov.ru (FAQ and /official-dealers, Q101, Q102,
// Q074, Q168; checked 2026-11-19). Dealer phone numbers and e-mails are deliberately NOT bundled: they live
// on the site's official dealers page only, so an offline copy can never go stale — the answer gives the
// page and the brand's direct contacts instead.

import { getData, type Lang } from './data.js';

// Same value as catalog.ts SITE; kept local so catalog.ts and bim.ts can import this module without a cycle.
const SITE = 'https://vargov.ru';

export type DealerRegionId = 'russia-cis' | 'dubai' | 'hanoi';

interface DealerRegion {
  id: DealerRegionId;
  city_en: string;
  city_ru: string;
  region_en: string;
  region_ru: string;
  /** ISO 3166-1 alpha-2. Empty for Dubai: it covers every country not listed elsewhere. */
  countries: string[];
}

export const DEALER_REGIONS: DealerRegion[] = [
  {
    id: 'russia-cis',
    city_en: 'Moscow, Russia',
    city_ru: 'Москва, Россия',
    region_en: 'Russia and the CIS',
    region_ru: 'Россия и страны СНГ',
    countries: ['RU', 'BY', 'KZ', 'AM', 'AZ', 'KG', 'MD', 'TJ', 'UZ', 'TM'],
  },
  {
    id: 'hanoi',
    city_en: 'Hanoi, Vietnam',
    city_ru: 'Ханой, Вьетнам',
    region_en: 'Vietnam, Laos, Cambodia, Thailand, Malaysia and Singapore',
    region_ru: 'Вьетнам, Лаос, Камбоджа, Таиланд, Малайзия и Сингапур',
    countries: ['VN', 'LA', 'KH', 'TH', 'MY', 'SG'],
  },
  {
    id: 'dubai',
    city_en: 'Dubai, UAE',
    city_ru: 'Дубай, ОАЭ',
    region_en: 'the Persian Gulf, Middle East, Americas, Europe, Asia, Africa and other regions',
    region_ru: 'Персидский залив, Ближний Восток, Америка, Европа, Азия, Африка и другие регионы',
    countries: [],
  },
];

// Names people actually type that ICU does not list as a country name.
const ALIASES: Record<string, string> = {
  uae: 'AE', emirates: 'AE', 'the emirates': 'AE', dubai: 'AE', 'abu dhabi': 'AE', sharjah: 'AE', 'al ain': 'AE',
  'оаэ': 'AE', 'эмираты': 'AE', 'дубай': 'AE', 'абу-даби': 'AE', 'абу даби': 'AE', 'шарджа': 'AE',
  usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', america: 'US', 'сша': 'US', 'америка': 'US',
  uk: 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB', 'англия': 'GB', 'великобритания': 'GB',
  russia: 'RU', 'russian federation': 'RU', moscow: 'RU', 'saint petersburg': 'RU', 'st petersburg': 'RU',
  'рф': 'RU', 'москва': 'RU', 'санкт-петербург': 'RU', 'петербург': 'RU', 'казань': 'RU', 'сочи': 'RU',
  hanoi: 'VN', 'ho chi minh city': 'VN', saigon: 'VN', 'ханой': 'VN', 'хошимин': 'VN',
  ksa: 'SA', riyadh: 'SA', jeddah: 'SA', 'эр-рияд': 'SA', doha: 'QA', 'доха': 'QA', muscat: 'OM', 'маскат': 'OM',
  bangkok: 'TH', 'бангкок': 'TH', 'kuala lumpur': 'MY', 'куала-лумпур': 'MY', almaty: 'KZ', astana: 'KZ', minsk: 'BY',
  'алматы': 'KZ', 'астана': 'KZ', 'минск': 'BY', 'ташкент': 'UZ', tashkent: 'UZ', baku: 'AZ', 'баку': 'AZ', yerevan: 'AM', 'ереван': 'AM',
};

// Codes Intl.DisplayNames knows that are not countries.
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'ZZ', 'QO', 'XA', 'XB']);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'’().,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let nameIndex: Map<string, string> | null = null;

/** name (English or Russian, as ICU spells it) → ISO code, built once from Intl.DisplayNames. */
function names(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const idx = new Map<string, string>();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const loc of ['en', 'ru']) {
    let dn: Intl.DisplayNames;
    try {
      dn = new Intl.DisplayNames([loc], { type: 'region' });
    } catch {
      continue;
    }
    for (const a of letters)
      for (const b of letters) {
        const code = a + b;
        if (NOT_COUNTRIES.has(code)) continue;
        let name: string | undefined;
        try {
          name = dn.of(code);
        } catch {
          continue;
        }
        if (!name || name === code || /unknown region|неизвестный регион/i.test(name)) continue;
        idx.set(norm(name), code);
      }
  }
  for (const [k, v] of Object.entries(ALIASES)) idx.set(norm(k), v);
  nameIndex = idx;
  return idx;
}

/** ISO alpha-2 code for a country name, ISO code or a major city; null when not recognised. */
export function countryCode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const idx = names();
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    return [...idx.values()].includes(code) ? code : null;
  }
  return idx.get(norm(raw)) ?? null;
}

function regionFor(code: string): DealerRegion {
  return DEALER_REGIONS.find((r) => r.countries.includes(code)) ?? DEALER_REGIONS.find((r) => r.id === 'dubai')!;
}

function brandContacts() {
  const org = getData().organization;
  return {
    email: org?.email ?? 'info@vargov.ru',
    whatsapp: org?.telephone ?? '+7 916 537 33 52',
    telegram: 'https://t.me/AntonVargov',
  };
}

export function dealerForCountry(country: string | undefined, lang: Lang = 'en') {
  const ru = lang === 'ru';
  const page = ru ? `${SITE}/official-dealers` : `${SITE}/en/official-dealers`;
  const regions = DEALER_REGIONS.map((r) => ({
    id: r.id,
    dealer_city: ru ? r.city_ru : r.city_en,
    region: ru ? r.region_ru : r.region_en,
  }));
  const common = {
    who_supplies_and_installs: ru
      ? 'Три официальных дилера, каждый отвечает за поставку, монтаж и обслуживание композиций в своём регионе. Монтаж силами официальных монтажных партнёров — отдельная услуга, стоимость рассчитывается индивидуально; можно заказать и шеф-монтаж.'
      : 'Three official dealers, each responsible for supply, installation and servicing of the compositions in its region. Installation by the official installation partners is a separate service, priced individually; supervised installation can also be ordered.',
    dealer_contacts_page: page,
    brand_direct_contacts: brandContacts(),
    regions,
    source: ru ? `${SITE}/faq` : `${SITE}/en/faq`,
  };

  const code = country ? countryCode(country) : null;
  if (!country) return { country: null, recommended: null, ...common };
  if (!code) {
    return {
      country,
      recommended: null,
      note: ru
        ? `Страну «${country}» не удалось распознать. Выберите регион из списка ниже; Дубай отвечает за все страны, не названные в двух других регионах.`
        : `Could not recognise "${country}" as a country. Pick the region from the list below; Dubai covers every country not named in the other two regions.`,
      ...common,
    };
  }
  const r = regionFor(code);
  const recommended = {
    country_code: code,
    dealer_region_id: r.id,
    dealer_city: ru ? r.city_ru : r.city_en,
    region: ru ? r.region_ru : r.region_en,
    contacts: page,
    orders: r.id === 'dubai'
      ? ru
        ? 'Заказы по Дубаю и этому региону принимает офис бренда в Дубае; контакты те же, что у дилера.'
        : "Orders for Dubai and this region are accepted by the brand's office in Dubai; the contacts are the dealer's."
      : ru
        ? 'Контакты дилера региона — на странице дилеров; с заказом поможет и менеджер бренда (Telegram, WhatsApp, e-mail).'
        : "The regional dealer's contacts are on the dealers page; the brand's manager also helps with the order (Telegram, WhatsApp, e-mail).",
  };
  return { country, recommended, ...common };
}

/** One line for texts that send the reader to "contact the brand": the regional dealer route. */
export function dealerRouteLine(lang: 'en' | 'ru'): string {
  return lang === 'ru'
    ? `В России и СНГ, в Персидском заливе и других регионах, во Вьетнаме и соседних странах за поставку и монтаж отвечает официальный дилер региона — контакты на ${SITE}/official-dealers (инструмент dealer_for_country подскажет дилера по стране).`
    : `In Russia and the CIS, in the Persian Gulf and other regions, and in Vietnam and its neighbours, the regional official dealer handles supply and installation — contacts at ${SITE}/en/official-dealers (the dealer_for_country tool names the dealer for a country).`;
}
