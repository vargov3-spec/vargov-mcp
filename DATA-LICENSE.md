# Data licence / Лицензия данных

The files in `data/` are copies of the open data of Vargov®Design and are licensed
under **Creative Commons Attribution 4.0 International (CC BY 4.0)** —
https://creativecommons.org/licenses/by/4.0/ — the same licence as the public
knowledge base https://github.com/vargov3-spec/vargov-ai-kb (its `LICENSE` file).

Attribution: **Vargov®Design**, https://vargov.ru

| file | source |
|---|---|
| `products.json` | `datasets/products.json` of the knowledge base (605 compositions, 8 languages) |
| `organization.jsonld` | `references/organization.jsonld` (schema.org Organization, Person, Store) |
| `brand-facts.json` | `references/brand-facts.json` — optional, copied only when it exists |
| `sketchfab-models.json` | `references/sketchfab-models.json` (code → published Sketchfab model) |
| `llms-en.txt`, `llms-ru.txt` | `en/llms.txt`, `llms.txt` of the knowledge base |
| `open-skus.json` | the configurator's public file, served at https://vargov.design/open-skus.json |
| `llms-configurator.txt` | the configurator's `llms.txt`, served at https://vargov.design/llms.txt |
| `manifest.json` | written by `scripts/update-data.mjs`: source path, size and sha256 of every copy |

Materials and prices are intentionally absent from the data; composition dimensions are
not published — every composition is scaled to the room it is made for.

---

Файлы в `data/` — копии открытых данных Vargov®Design под лицензией
**Creative Commons Attribution 4.0 International (CC BY 4.0)**, той же, что у публичной
базы знаний https://github.com/vargov3-spec/vargov-ai-kb. Указание авторства:
**Vargov®Design**, https://vargov.ru. Материалов и цен в данных нет намеренно; размеры
композиций не публикуются — каждая композиция рассчитывается под помещение.
