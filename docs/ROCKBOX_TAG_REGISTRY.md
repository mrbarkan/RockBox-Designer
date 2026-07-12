# Rockbox Tag Registry

## Purpose and boundary

`rockbox/registry/generated/rockbox-tags.json` is a generated factual index of the tag table in a separately checked-out Rockbox source tree. It contains tag names, token identifiers, raw parameter specifications, raw flag expressions, source-derived categories, and the minimum browser support states.

It does not contain or execute the Rockbox parser. Unknown names remain valid lossless source in Rockbox Designer.

## Generate

Use a local checkout at the revision documented in `docs/UPSTREAM_ROCKBOX.md`:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run registry:generate
```

The generator reads only:

```text
lib/skin_parser/tag_table.c
lib/skin_parser/tag_table.h
```

It records the full Git SHA, commit timestamp, generation timestamp, repository, and source paths. Re-running against the same checked-in output retains its generation timestamp so verification is byte-for-byte reproducible. Pass `-- --refresh-timestamp` to intentionally record a new generation time.

## Verify

Ordinary validation checks the JSON schema, duplicate names, attribution fields, support metadata, and agreement with the SHA in `docs/UPSTREAM_ROCKBOX.md` without network access:

```bash
npm run registry:verify
```

When a local source tree is available, the same command also regenerates in memory and requires an exact byte match:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run registry:verify
```

## Support metadata

Every generated official name is currently marked `preserved` and `parsed`: the lossless syntax layer can retain it and choose its official longest name boundary. Higher states—`interpreted`, `rendered`, `editable`, and `officially-validated`—must only be added as separate product evidence proves them.

## Attribution and licensing review

Rockbox is copyright its contributors and is distributed under the GNU General Public License, version 2 or later. The inspected source files carry that notice, and Rockbox's license text is at `docs/COPYING` in the upstream checkout.

The generated registry is intended to contain facts and short symbolic identifiers rather than implementation code. No Rockbox parser functions or comments are copied. This boundary is an engineering precaution, not legal advice. **Human licensing review is required before making distribution or relicensing assumptions about the generated registry.**
