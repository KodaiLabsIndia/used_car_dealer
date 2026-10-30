# Vehicle name references

This is the first searchable reference import, not a complete India vehicle,
generation, year or variant catalogue. Never infer fitted safety equipment or
India availability from the global name list.

`global-models.json` is the MIT-licensed name index from
[serhatkildaci/global-car-models](https://github.com/serhatkildaci/global-car-models),
pinned at `44da5c9e5e0f3162d65579033f7a641473308b11`. Its unchanged licence is
retained in `LICENSE-global-models.txt`. `source.json` records the revision,
SHA-256, source URL and scope; the importer checks the bytes before writing.

`india-references.json` contains 32 original factual name/body references from
the linked manufacturer pages and Arihant stock, observed 30 October 2026.
Each row retains its source URL. This does not establish a model's generations,
variants, equipment, full production period or current availability.

The first combined import contains 96 makes and 1,857 distinct make/model name
references, including those 32 India references. Verified variants: **zero**.
The authenticated coverage endpoint reports these limitations. The picker labels
global references separately and permits manual vehicle identification.

Run after migrations, from `apps/api`:

```sh
.venv/bin/python -m app.import_catalogue
```

Imports are transactional and idempotent. Stable IDs let an actual vehicle keep
its selected name reference. Its inspection separately snapshots observed body,
fuel, transmission and unknown equipment. Existing tasks are never regenerated
when the catalogue changes.

To expand coverage, obtain permitted India generation/variant data or original
manufacturer references, retain provenance, validate aliases and dates, and
publish a new release with a coverage/gap report. Do not relabel the present
global import as India-complete or use an LLM to invent equipment.
