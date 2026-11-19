# @vargov/mcp — Vargov®Design для ИИ-ассистентов / for AI assistants

MCP-сервер (Model Context Protocol), который даёт ассистенту в Claude Desktop, Cursor и любом другом
клиенте MCP каталог Vargov®Design, ссылки в 3D-конфигуратор с размерами помещения и пошаговую
инструкцию, как получить IFC4 (BIM) и FBX. **Все данные лежат в пакете; в работе сервер в сеть не
ходит.**

An MCP (Model Context Protocol) server that gives an assistant in Claude Desktop, Cursor or any other
MCP client the Vargov®Design catalogue, links into the 3D configurator with the room dimensions filled
in, and the step-by-step way to get IFC4 (BIM) and FBX files. **All data is bundled; the server makes
no network calls at runtime.**

Пример / example:

> «Подбери световую композицию для гостиной 6 × 4 м с потолком 3,2 м и дай ссылку в конфигуратор»
> → `search_compositions` → `get_composition` → `build_configurator_link({ code, lengthMm: 6000, widthMm: 4000, ceilingMm: 3200 })` → `how_to_get_bim`.

---

## Русский

### Что умеет

| Инструмент | Что делает |
|---|---|
| `search_compositions` | Поиск по 605 композициям (коды LC0001…LC0602): по коду, по типу и по авторским текстам бренда (описание, где уместна, стилистика) на русском и английском; другие языки сайта тоже ищутся. Фильтры: `family` (lighting · decorative · sculptural-decor · floor-table-lamps), `lit` (подсказка по подписям: семейство «световые» или тип со словами light/lamp/backlit), `awarded` (есть награда), `configurable` (открывается в конфигураторе с полным расчётом — 360 из 605), `limit` (по умолчанию 10, не больше 50). Ответ — компактные строки: код, названия RU/EN, семейство, тип, флаги, страницы сайта, обложка, сниппет. |
| `get_composition` | Карточка композиции по коду (`LC0564`, `lc0564`, `564`): названия, семейство и тип, тексты бренда на выбранном языке (`lang`: ru en de it fr es vi ar), страницы сайта на 8 языках, обложка, 3D-модели (3ddd/3dsky, Sketchfab), награды, факт сертификации (без номеров), статус в конфигураторе: полный расчёт или индивидуальный; вид (облако элементов · лента · цепочка · на каркасе · готовая сцена); выгрузки IFC4/FBX/PDF/тендерный лист; есть ли монтажная схема 1:1; готовые ссылки RU/EN. |
| `build_configurator_link` | Ссылка в конфигуратор по договору ключей: `sku`, `w` (поле **«Длина»** плана, мм), `l` (поле **«Ширина»**, мм), `h` (высота облака элементов, мм), `ceil` (высота потолка помещения, мм; уходит в IFC4 и AR), `lang`, при желании `step=form`. Принимает только коды, которые открываются с расчётом; для остальных — ошибка со ссылкой на карточку. Размеры — целые миллиметры, план не меньше 300 × 300 мм. Русский интерфейс открывается на configurator.vargov.ru, остальные языки — на vargov.design. |
| `how_to_get_bim` | Пошагово: шаг «3D схема композиции» → ящик «Документы» → «Скачать IFC (BIM)» / «Скачать FBX (3ds Max)»; что лежит в IFC4 (IfcLightFixture / IfcFurnishingElement, точки крепления отдельными объектами IfcDiscreteAccessory с числом элементов и — когда масса известна — нагрузкой, GUID от конфигурации; чего в IFC4 нет: тросов, каркаса, контуров подсветки) и в FBX (объекты в мм, нити телами, одно крепление на отверстие в потолке, без текстур и UV, без свойств BIM); когда открывается схема 1:1 (после запуска ТЗ в производство; 345 из 360). С кодом — ответ начинается со статуса этой композиции. Текст на английском или русском (`lang`). |
| `brand_facts` | Карточка бренда: основатель и год, каталог и семейства, круг конфигуратора (360 с расчётом, 345 со схемой 1:1), 26 достижений на международных премиях (число и список считаются из `organization.jsonld`), сертификация, товарные знаки, шоурум, контакты, страница дилеров, языки, ссылки на llms.txt сайта, базы знаний и конфигуратора, датасет на Hugging Face. |
| `dealer_for_country` | Кто поставляет, монтирует и обслуживает композиции в стране: официальный дилер региона (Москва — Россия и СНГ; Ханой — Вьетнам, Лаос, Камбоджа, Таиланд, Малайзия, Сингапур; Дубай — Персидский залив, Ближний Восток, Америка, Европа, Азия, Африка и все остальные страны), страница с контактами дилеров, прямые контакты бренда, условия монтажа как на сайте. Страна — названием по-русски или по-английски, кодом ISO или крупным городом. Контакты дилеров в пакет не вшиты — они только на странице сайта. |

Ресурсы MCP: `llms://vargov` — `en/llms.txt` базы знаний; `llms://vargov/ru` — русский `llms.txt`;
`llms://vargov/configurator` — `llms.txt` конфигуратора.

Чего сервер **не делает** и не обещает: не называет цены, материалы и размеры композиций (бренд их
не публикует — каждая композиция рассчитывается под помещение), не оформляет заказы и заявки, не
считает раскладку сам (это делает конфигуратор по ссылке), не ходит в сеть.

### Откуда данные

`data/` — копии открытых файлов (лицензия CC BY 4.0, см. `DATA-LICENSE.md`): `datasets/products.json`
и `references/*.json` базы знаний [vargov3-spec/vargov-ai-kb](https://github.com/vargov3-spec/vargov-ai-kb),
`open-skus.json` и `llms.txt` конфигуратора (они же отдаются на https://vargov.design/open-skus.json и
https://vargov.design/llms.txt). В `data/manifest.json` — дата сборки и sha256 каждого файла. Каталог
меняется — новые версии пакета выходят вместе с обновлением базы знаний; первичен сайт https://vargov.ru.

Числа в ответах (605, 360, 345, 26, 354/113/82/56, 310) не вписаны руками — они считаются из этих
файлов и проверяются тестом перед каждой публикацией.

### Как подключить

Нужен Node.js 20+. Ставить отдельно ничего не надо — клиент сам запустит пакет через `npx`.

**Claude Desktop** — `claude_desktop_config.json`
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`, macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vargov-design": { "command": "npx", "args": ["-y", "@vargov/mcp"] }
  }
}
```

**Cursor** — `.cursor/mcp.json` в проекте или `~/.cursor/mcp.json` глобально, тот же блок `mcpServers`.

**Claude Code** — одной командой: `claude mcp add vargov-design -- npx -y @vargov/mcp`.

После подключения спросите ассистента, например: «Найди у Vargov®Design световую композицию для
лобби с потолком 6 м и дай ссылку в конфигуратор».

---

## English

### What it does

| Tool | Purpose |
|---|---|
| `search_compositions` | Search over the 605 compositions (codes LC0001…LC0602) by code, type label and the brand's own texts (description, where it works, style) in Russian and English; other site languages are matched too. Filters: `family` (lighting · decorative · sculptural-decor · floor-table-lamps), `lit` (a hint from labels: the lighting family or a type mentioning light/lamp/backlit), `awarded`, `configurable` (opens in the configurator with a full calculation — 360 of 605), `limit` (default 10, max 50). Returns compact rows: code, names RU/EN, family, type, flags, site pages, cover, snippet. |
| `get_composition` | The card of one composition by code (`LC0564`, `lc0564`, `564`): names, family and type, the brand's texts in the requested language (`lang`: ru en de it fr es vi ar), site pages in 8 languages, cover, 3D models (3ddd/3dsky, Sketchfab), awards, certification as a bare fact, configurator status: full calculation or individual; kind (cloud of elements · ribbon · chain · on a frame · ready scene); IFC4/FBX/PDF/tender-sheet exports; whether the 1:1 ceiling drawing exists; ready links RU/EN. |
| `build_configurator_link` | A configurator link by the link-keys contract: `sku`, `w` (the **"Length"** field of the plan, mm), `l` (the **"Width"** field, mm), `h` (height of the cloud of elements, mm), `ceil` (room ceiling height, mm; goes into IFC4 and AR), `lang`, optionally `step=form`. Accepts only codes that open with a calculation; others get an error with the product page. Integer millimetres; the plan is at least 300 × 300 mm. The Russian interface opens on configurator.vargov.ru, other languages on vargov.design. |
| `how_to_get_bim` | Step by step: the "3D composition scheme" step → the "Documents" drawer → "Download IFC (BIM)" / "Download FBX (3ds Max)"; what the IFC4 holds (IfcLightFixture / IfcFurnishingElement, fixing points as separate IfcDiscreteAccessory objects with element count and, where the mass is known, load, GUIDs derived from the configuration; not in IFC4: cables, frame, backlight contours) and what the FBX holds (objects in mm, strands as bodies, one fixing per ceiling hole, no textures or UVs, no BIM properties); when the 1:1 drawing opens (after the production brief is started in production; 345 of 360). With a code, the answer starts with that composition's status. English or Russian (`lang`). |
| `brand_facts` | The brand card: founder and year, catalogue and families, configurator scope (360 with a full calculation, 345 with the 1:1 drawing), 26 awards from international juries (count and list computed from `organization.jsonld`), certification, trademarks, showroom, contacts, dealers page, languages, links to the llms.txt of the site, the knowledge base and the configurator, the dataset on Hugging Face. |
| `dealer_for_country` | Who supplies, installs and services the compositions in a country: the regional official dealer (Moscow — Russia and the CIS; Hanoi — Vietnam, Laos, Cambodia, Thailand, Malaysia, Singapore; Dubai — the Persian Gulf, Middle East, Americas, Europe, Asia, Africa and every other country), the page with the dealer contacts, the brand's direct contacts, the installation terms as published. Country by English or Russian name, ISO code or a major city. Dealer contacts are not bundled — they live on the site page only. |

MCP resources: `llms://vargov` — the knowledge base's `en/llms.txt`; `llms://vargov/ru` — the Russian
`llms.txt`; `llms://vargov/configurator` — the configurator's `llms.txt`.

What the server **does not** do or promise: it names no prices, materials or composition dimensions
(the brand does not publish them — every composition is scaled to the room), it places no orders or
requests, it does not compute the layout itself (the configurator does, through the link), and it
never calls the network.

### Where the data comes from

`data/` holds copies of public files (CC BY 4.0, see `DATA-LICENSE.md`): `datasets/products.json` and
`references/*.json` of the knowledge base [vargov3-spec/vargov-ai-kb](https://github.com/vargov3-spec/vargov-ai-kb),
and the configurator's `open-skus.json` and `llms.txt` (also served at https://vargov.design/open-skus.json
and https://vargov.design/llms.txt). `data/manifest.json` records the build date and the sha256 of every
file. The catalogue changes, so new package versions follow knowledge-base updates; the site
https://vargov.ru is the primary source.

The numbers in the answers (605, 360, 345, 26, 354/113/82/56, 310) are not typed in: they are computed
from these files and checked by the test before every release.

### Install and connect

Node.js 20+ required. Nothing to install by hand — the client starts the package through `npx`.

**Claude Desktop** — `claude_desktop_config.json`
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`, macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vargov-design": { "command": "npx", "args": ["-y", "@vargov/mcp"] }
  }
}
```

**Cursor** — `.cursor/mcp.json` in the project or `~/.cursor/mcp.json` globally, the same `mcpServers` block.

**Claude Code** — one command: `claude mcp add vargov-design -- npx -y @vargov/mcp`.

Then ask the assistant, for example: "Find a Vargov®Design light composition for a lobby with a 6 m
ceiling and give me the configurator link."

### Licence

Code — MIT (`LICENSE`). Data in `data/` — CC BY 4.0, attribution "Vargov®Design", https://vargov.ru
(`DATA-LICENSE.md`).
