// how_to_get_bim: the steps and the contents of the IFC4 / FBX files.
// Wording follows the public sources of the brand, not this server's own ideas:
//  - en/llms.txt and llms.txt of vargov-ai-kb (sections "For architects and specifiers", "New in October 2026");
//  - knowledge/ifc4-in-the-model-essay.md (IfcDiscreteAccessory, IfcLightFixture/IfcFurnishingElement, GUIDs);
//  - knowledge/whats-new-2026-10.md (FBX, production brief, 1:1 drawing);
//  - docs/ssylka-i-tekst-dlya-tz.md of the configurator (link keys; the "Share" button).

import { findEntry, hasMountScheme, kindNotes, mountSchemeNote } from './catalog.js';
import { getData, type Kind, type Lang } from './data.js';
import { dealerRouteLine } from './dealers.js';

function statusEn(code: string, kind: Kind | null, configurable: boolean, page: string): string {
  if (!configurable) {
    return (
      `## ${code}: calculated individually\n\n` +
      `The configurator does not calculate ${code}, so there is no IFC4 export, no FBX export, no PDF specification from the configurator and no 1:1 ceiling drawing for it, and the production brief cannot be started for it (360 of the 605 compositions open with a full calculation; this one is not among them). ` +
      `Product page: ${page}. For a calculation contact the brand: info@vargov.ru, WhatsApp +7 916 537 33 52, Telegram @AntonVargov. ${dealerRouteLine('en')}\n`
    );
  }
  const lines = [`## ${code}: opens in the configurator with a full calculation (${kind})`, ''];
  lines.push(`IFC4 (BIM) and FBX (3ds Max) are exported by the visitor; the PDF specification and the tender sheet come from the same "Documents" drawer.`);
  lines.push(hasMountScheme(kind) ? `1:1 ceiling drawing: yes, from the production brief after the brief is started in production (see below).` : `1:1 ceiling drawing: no. ${mountSchemeNote(kind) ?? ''}`);
  for (const n of kindNotes(code, kind)) lines.push(n);
  lines.push('');
  return lines.join('\n') + '\n';
}

function statusRu(code: string, kind: Kind | null, configurable: boolean, page: string): string {
  if (!configurable) {
    return (
      `## ${code}: рассчитывается индивидуально\n\n` +
      `Конфигуратор не рассчитывает ${code}: у этой композиции нет выгрузки IFC4 и FBX, нет PDF-спецификации из конфигуратора и нет монтажной схемы 1:1, ТЗ на производство для неё не заводится (с полным расчётом открываются 360 композиций из 605; этой среди них нет). ` +
      `Карточка: ${page}. За расчётом — к бренду: info@vargov.ru, WhatsApp +7 916 537 33 52, Telegram @AntonVargov. ${dealerRouteLine('ru')}\n`
    );
  }
  const kindRu: Record<string, string> = { cloud: 'облако элементов', ribbon: 'лента', chain: 'цепочка', frame: 'композиция на каркасе', 'ready-scene': 'готовая сцена' };
  const lines = [`## ${code}: открывается в конфигураторе с полным расчётом (${kindRu[kind ?? 'cloud'] ?? kind})`, ''];
  lines.push('IFC4 (BIM) и FBX (3ds Max) посетитель выгружает сам; PDF-спецификация и тендерный лист — в том же ящике «Документы».');
  if (hasMountScheme(kind)) lines.push('Монтажная схема 1:1: есть — со страницы ТЗ, после запуска ТЗ в производство (ниже).');
  else if (kind === 'ribbon') lines.push('Монтажной схемы 1:1 нет: у ленты нет облака элементов, устройство своё.');
  else if (kind === 'frame') lines.push('Монтажной схемы 1:1 нет: у элементов своих нитей к потолку нет — они висят на каркасе, а сам каркас подвешен к потолку; в IFC4 записано число подвесов каркаса (свойство SuspensionCount), но не их координаты, а сами точки видны на чертеже каркаса и на виде сбоку в конфигураторе.');
  else if (kind === 'ready-scene') lines.push('Монтажной схемы 1:1 нет: это настенное бра — композиция готовая, а не рассчитанная, раскладки нет, значит, нет и разметки потолка; точек крепления к потолку в IFC4 нет.');
  if (kind === 'ribbon') lines.push('Лента: длина и ширина плана и высота композиции читаются из ссылки; пластика ленты (волна/спираль) выбирается в конфигураторе; кнопка выгрузки FBX у ленты — в панели ленты.');
  if (kind === 'chain') lines.push('Цепочка: форма на сборку не влияет — её раскладывает свой движок.');
  if (kind === 'frame') lines.push('Каркас: число элементов конфигуратор считает по шагу и длине каркаса, руками его не ввести.');
  if (kind === 'ready-scene') lines.push('Готовая сцена: открывается как собственная 3D-модель; размеры плана в ссылке заменяются размером изделия; поля «Высота потолка» нет: в IFC4 модель ставится под потолок 2700 мм (значение по умолчанию), и в самом файле эта высота свойством не объявлена.');
  if (code === 'LC0106') lines.push('LC0106: вместо размеров плана конфигуратор берёт число медуз и просвет между ними (ключи jelly и jgap); w/l/h в ссылке для этой композиции не действуют.');
  lines.push('');
  return lines.join('\n') + '\n';
}

const GUIDE_EN = `# How to get the IFC4 (BIM) and FBX files of a Vargov®Design composition

**Scope.** The configurator (https://vargov.design, Russian copy https://configurator.vargov.ru) opens 360 of the 605 catalogue compositions with a full calculation: a 3D layout for the room, the ceiling fixing points, a PDF specification, a tender sheet, an IFC4 model for BIM and an FBX model for 3ds Max (verified 25 October 2026 against the configurator's open-skus.json and the catalogue dataset). The other compositions are calculated individually by the brand: they have no export and no 1:1 drawing. The site page of a composition that qualifies carries the line "IFC4 · PDF spec sheet · tender sheet — in the configurator".

## Steps

1. Open the configurator with the composition — a link from \`build_configurator_link\` already carries the plan dimensions, the ceiling height and the language (for example \`https://vargov.design/?sku=LC0599&w=1000&l=1000&ceil=3200&lang=en\`).
2. Set the plan (Length × Width — the zone the composition is laid out in), the height of the cloud of elements, pick element sizes and colours, and choose the form of the composition at the step "Composition form". The configurator lays the elements out in 3D and counts the ceiling fixing points.
3. Go to the step **"3D composition scheme"** and open the **"Documents"** drawer.
4. Set the **ceiling height** in the field above the IFC button (default 2,700 mm — the room height, not a product size). It goes into the IFC4 file (the model is built under that ceiling, the fixing points sit on its plane, property CeilingHeight) and into AR; it does not change the layout, the mass or the specification. The ready scene LC0406-1 has no such field: its IFC4 model is placed under a 2,700 mm ceiling (the default), and the file does not declare that height as a property.
5. Click **"Download IFC (BIM)"**. Right under it, click **"Download FBX (3ds Max)"**. A ribbon has its own export button, in the ribbon panel.
6. The **"Share"** button copies a link that reopens the very same calculation (the address bar of the configurator does not reflect the state — use the copied link). The configurator's **"Fill in the spec"** button carries the composition into the online production brief (see below).

## What is in the IFC4 file

- Schema IFC4. Lit elements are exported as \`IfcLightFixture\`, unlit ones as \`IfcFurnishingElement\` — the test is applied to the element, not to the article. Known exception: in LC0523 the light comes from backlight contours, so its elements go out as \`IfcFurnishingElement\`.
- Every point where the composition meets the ceiling is its own \`IfcDiscreteAccessory\` object in its own place, with the number of elements hanging from it and, where the mass is known, the estimated load on that point (a backlight-contour point carries a load of zero). Compositions on a frame hang from the frame, and the frame itself is suspended from the ceiling — the file records the number of frame suspensions (property SuspensionCount) but not their coordinates; the ready scene LC0406-1 is a wall sconce. Their files carry no ceiling fixing points (5 of the 360).
- The BIM properties — loads, mass, power, article codes — are in the IFC4 file (the FBX has none).
- What the IFC4 file does not contain: the cables and wires themselves (only the points where they reach the ceiling), the load-bearing frame, and the backlight contours.
- GUIDs are derived from the configuration: the same configuration always gives the same GUIDs, different ones give different GUIDs, so two compositions of one article combine in one federated model without clashes.
- The origin stays on the floor; the model is built for the stated ceiling height. On a non-Russian interface the names in the file are in English.
- There is no Revit family (.rfa) — the brand does not issue one. DXF drawings exist for the brand's production and dealers only.

## What is in the FBX file

- The composition assembled, as separate objects, in millimetres; the suspension strands as solid bodies; the ceiling fixings as separate objects (one per ceiling hole: two strands meeting in one hole share one fixing; a strand that runs from the frame rather than from the ceiling carries none); the ceiling plane. Unlike IFC4, the FBX also carries the frame and the metal base.
- The origin is the ceiling and the composition hangs down (IFC4 keeps the origin on the floor).
- Colour and opacity carry over; there are no textures and no UVs; identical elements are copies of one geometry.
- No BIM properties: loads, mass, power and article codes stay in the IFC4 file.
- Plain import: the scale is declared inside the file, so a 1,500 mm composition opens as 1,500 mm whatever the system units are, and the importer itself turns it to the Z-up that 3ds Max expects.

## 1:1 ceiling setting-out drawing (PDF)

- Comes from the online production brief, https://vargov.ru/en/specifications (Russian and English only): no sign-in and no registration, only the "Object" field is required; a saved brief opens by its own link with a key. Available right after saving: the "3D configuration" page, the brief as a PDF in Russian and English, and the FBX export. The brief carries no price — it is a production brief, not a quote and not an order.
- The 1:1 drawing **unlocks only after a manager starts the brief in production**; until then the button is inactive. It is preliminary: before the ceiling is set out it is confirmed by the production engineer, and that note is printed on the sheets.
- Four sheets — plotter and A4, each for the ceiling and for the floor; print at exactly 100 % (a 100 mm segment on the sheet is there to check with a ruler); the plotter sheet runs in one piece up to 5 m and is split beyond that.
- Exists for 345 of the 360 compositions: not for the 10 ribbons, not for the 4 compositions on a frame, not for the ready scene LC0406-1. Not issued to the client when the brief specifies mounting on the metal base: the base arrives with its holes and fixings already in place (with that mounting the brief offers one power option, 12 V through a driver).

## Pages

- IFC4 export: https://vargov.ru/en/configurator/ifc4 · FBX export: https://vargov.ru/en/configurator/fbx
- How many ceiling mounting points a fitting needs: https://vargov.ru/en/guides/mounting-points
- Essay "The light fitting that never arrives in the model": https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/knowledge/ifc4-in-the-model-essay.md
- Installation and wiring guides (PDF, eight languages): https://vargov.ru/en/installation
`;

const GUIDE_RU = `# Как получить IFC4 (BIM) и FBX композиции Vargov®Design

**Круг.** Конфигуратор (https://configurator.vargov.ru, международная площадка https://vargov.design) открывает с полным расчётом 360 композиций каталога из 605: 3D-раскладка под помещение, точки крепления к потолку, PDF-спецификация, тендерный лист, модель IFC4 для BIM и модель FBX для 3ds Max (проверено 25.10.2026 прогоном open-skus.json конфигуратора и датасета каталога). Остальные композиции бренд рассчитывает индивидуально: выгрузки и схемы 1:1 у них нет. На карточке композиции, которая открывается с расчётом, стоит строка «IFC4 · PDF-спецификация · тендерный лист — в конфигураторе».

## Шаги

1. Откройте конфигуратор с композицией — ссылка из \`build_configurator_link\` уже несёт размеры плана, высоту потолка и язык (например \`https://configurator.vargov.ru/?sku=LC0599&w=1000&l=1000&ceil=3200&lang=ru\`).
2. Задайте план (Длина × Ширина — зона, в которой раскладывается композиция), высоту облака элементов, размеры и цвета элементов и выберите форму на шаге «Форма композиции». Конфигуратор раскладывает элементы в 3D и считает точки крепления к потолку.
3. Перейдите на шаг **«3D схема композиции»** и откройте ящик **«Документы»**.
4. Укажите **высоту потолка** в поле над кнопкой IFC (по умолчанию 2700 мм — высота помещения, не размер изделия). Она уходит в IFC4 (сборка под потолок, точки крепления на его плоскости, свойство CeilingHeight) и в AR; на раскладку, массу и спецификацию не влияет. У готовой сцены LC0406-1 этого поля нет: в IFC4 она ставится под потолок 2700 мм (значение по умолчанию), и в самом файле эта высота свойством не объявлена.
5. Нажмите **«Скачать IFC (BIM)»**. Сразу под ней — **«Скачать FBX (3ds Max)»**. У ленты своя кнопка выгрузки — в панели ленты.
6. Кнопка **«Поделиться»** копирует ссылку, которая открывает тот же расчёт (адресная строка конфигуратора состояние не отражает — берите скопированную ссылку). Кнопка **«Заполнить ТЗ»** переносит композицию в онлайн-ТЗ на производство (ниже).

## Что лежит в файле IFC4

- Схема IFC4. Светящиеся элементы выгружаются классом \`IfcLightFixture\`, несветящиеся — \`IfcFurnishingElement\`; признак берётся по элементу, а не по артикулу. Известное исключение: у LC0523 свет дают контуры подсветки, поэтому её элементы уходят классом \`IfcFurnishingElement\`.
- Каждая точка, где композиция встречается с потолком, — свой объект \`IfcDiscreteAccessory\` на своём месте; на нём записано число элементов, которые на нём висят, и, когда масса известна, расчётная нагрузка на эту точку (у точки контура подсветки нагрузка нулевая). Композиции на каркасе висят на каркасе, а сам каркас подвешен к потолку — в файл уходит число подвесов каркаса (свойство SuspensionCount), но не их координаты; готовая сцена LC0406-1 — настенное бра. Точек крепления к потолку в их файлах нет (5 артикулов из 360).
- Свойства BIM — нагрузки, масса, мощность, коды артикулов — лежат в IFC4 (в FBX их нет).
- Чего в IFC4 нет: самих тросов и проводов (только точки, где они приходят в потолок), несущего каркаса и контуров подсветки.
- GUID строятся от конфигурации: одна и та же конфигурация даёт те же GUID, разные — разные, поэтому две композиции одного артикула сводятся в одну BIM-модель без совпадений.
- Начало координат — на полу; файл строится под заданную высоту потолка. На нерусском интерфейсе имена в файле английские.
- Библиотечного семейства Revit (.rfa) у бренда нет. Чертежи DXF — только для производства и дилеров бренда.

## Что лежит в файле FBX

- Композиция в сборе отдельными объектами, в миллиметрах; нити подвеса — телами; потолочные крепления — отдельными объектами (одно крепление на каждое отверстие в потолке: две нити, сошедшиеся в одно отверстие, несут один узел; нить от каркаса крепления не несёт); плоскость потолка. В отличие от IFC4, в FBX есть каркас и металлическая база.
- Начало координат — потолок, композиция висит вниз (у IFC4 начало на полу).
- Цвет и прозрачность переносятся; текстур и UV нет; одинаковые элементы — копии одной геометрии.
- Свойств BIM нет: нагрузки, масса, мощность и коды артикулов остаются в IFC4.
- Вставляется обычным импортом: масштаб объявлен внутри файла, композиция 1500 мм открывается как 1500 мм при любых системных единицах, разворот в Z-вверх делает сам импортёр.

## Монтажная схема разметки потолка 1:1 (PDF)

- Выдаётся страницей онлайн-ТЗ https://vargov.ru/specifications (только русский и английский): вход и регистрация не нужны, обязательно только поле «Объект»; сохранённое ТЗ открывается по своей ссылке с ключом. Сразу после сохранения доступны страница «3D-конфигурация», PDF ТЗ на русском и английском и выгрузка FBX. Цены в ТЗ нет — это техническое задание на производство, не заявка и не заказ.
- Схема 1:1 **открывается только после того, как менеджер запустит ТЗ в производство**; до этого кнопка неактивна. Схема предварительная: перед разметкой потолка её подтверждает технолог производства, и эта пометка напечатана на самих листах.
- Четыре листа — для плоттера и A4, каждый на потолок и на пол; печать строго 100 % (на листе отрезок 100 мм для проверки линейкой); лист плоттера идёт одним куском до 5 м, дальше режется.
- Есть у 345 из 360 композиций: нет у 10 лент, у 4 композиций на каркасе и у готовой сцены LC0406-1. Заказчику не выдаётся, если в ТЗ выбран монтаж на металлическую базу: база приходит с готовыми отверстиями и монтажными элементами (при таком монтаже подключение в ТЗ одно — 12 В через драйвер).

## Страницы

- Выгрузка IFC4: https://vargov.ru/configurator/ifc4 · выгрузка FBX: https://vargov.ru/configurator/fbx
- Сколько точек крепления нужно светильнику: https://vargov.ru/guides/tochki-krepleniya
- Эссе «Светильник, который не доезжает до модели»: https://raw.githubusercontent.com/vargov3-spec/vargov-ai-kb/main/knowledge/ifc4-in-the-model-essay.md
- Монтаж и подключение (PDF на восьми языках): https://vargov.ru/installation
`;

export function bimGuide(codeInput?: string, lang: Lang = 'en'): string {
  const ru = lang === 'ru';
  let head = '';
  if (codeInput && codeInput.trim()) {
    const e = findEntry(codeInput);
    if (!e) {
      head = ru
        ? `## Код «${codeInput}» в каталоге не найден (LC0001…LC0602, у части артикулов суффикс -1/-2). Найдите код через search_compositions.\n\n`
        : `## Code "${codeInput}" is not in the catalogue (LC0001…LC0602, some with a -1/-2 suffix). Find the code with search_compositions.\n\n`;
    } else {
      const page = e.p.urls?.[ru ? 'ru' : 'en'] ?? '';
      head = (ru ? statusRu : statusEn)(e.code, e.kind, e.configurable, page) + '\n';
    }
  }
  return head + (ru ? GUIDE_RU : GUIDE_EN);
}

export function bimCounts() {
  const d = getData();
  const open = d.openSet.size;
  const withScheme = [...d.openSet].filter((c) => hasMountScheme(d.byCode.get(c)?.kind ?? (d.ribbons.has(c) ? 'ribbon' : d.chains.has(c) ? 'chain' : d.frames.has(c) ? 'frame' : d.readyScenes.has(c) ? 'ready-scene' : 'cloud'))).length;
  return { open, withScheme, ribbons: d.ribbons.size, frames: d.frames.size, readyScenes: d.readyScenes.size, chains: d.chains.size };
}
