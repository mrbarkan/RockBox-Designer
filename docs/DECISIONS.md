# Architecture Decisions

## ADR-0001 — Treat Rockbox source as the future authoritative document

**Status:** Accepted

**Context:** The prototype can flatten imported source into visual elements and reconstruct AST syntax, which cannot guarantee preservation of real themes.

**Decision:** The project will introduce a lossless concrete syntax tree alongside the legacy parser. Visual state, semantic interpretation, rendering, validation, and editing will be projections or narrow operations over that source document.

**Consequences:** Untouched source must eventually round-trip exactly. Unknown and malformed syntax must remain present. The legacy parser stays in place until later migration tests prove that callers can move safely.

## ADR-0002 — Keep Phase 0 behavior-neutral except for baseline repairs

**Status:** Accepted

**Context:** TypeScript checking exposed duplicated declarations and missing AST editor wiring on the current default branch. Parser replacement is explicitly outside Phase 0.

**Decision:** Phase 0 may repair compile/runtime wiring needed for a clean baseline, but it will not change parser, serializer, package, rendering, or UI contracts.

**Consequences:** The current compatibility limitations remain visible and documented. Phase 1A starts only after the Phase 0 validation and pull request are complete.

## ADR-0003 — Use one root source with absolute spans for all syntax documents

**Status:** Accepted

**Context:** Conditional branches need to serialize as independent documents while diagnostics and later editing commands still require coordinates in the original file.

**Decision:** Root and branch `RockboxDocument` values share the original source string and carry absolute, half-open spans. Clean documents serialize their source span directly; clean nodes serialize their exact `raw` slice. Tag arguments remain raw syntax and are not semantically split during initial parsing.

**Consequences:** Untouched source and branches round-trip exactly, line/column diagnostics remain globally meaningful, and Phase 1B can target narrow source regions. Callers must not assume a branch document's source string contains only that branch.

## ADR-0004 — Make lossless source authoritative and derive the legacy preview AST

**Status:** Accepted

**Context:** The canvas evaluator still consumes the legacy AST, but using that simplified tree as the export source would undo Phase 1A preservation guarantees.

**Decision:** Imported screens retain a lossless `RockboxDocument`. All Phase 1B edits and screen compilation use it. After an edit, the application serializes the lossless document and reparses that source into a legacy AST only for the current renderer. Saved projects without a lossless document migrate lazily from their stored raw legacy source.

**Consequences:** Export no longer depends on normalized legacy nodes, existing preview behavior remains available, and migration is incremental. The derived AST may still render approximately, and Phase 2 must move semantic interpretation off the legacy representation.

## ADR-0005 — Use archive paths and bytes as package identity

**Status:** Accepted

**Context:** Basename-keyed data URLs cannot distinguish duplicate assets, preserve unknown binary files reliably, or produce deterministic package manifests.

**Decision:** Imported files are identified by normalized, case-sensitive archive path and stored as `Uint8Array` bytes with SHA-256 hashes. Data URLs are derived UI state. CFG and screen documents preserve source, and ZIP export sorts entries with fixed metadata.

**Consequences:** Duplicate basenames remain safe, unknown files survive, and logical manifests are reproducible. Project persistence needs explicit typed-array encoding, and case mismatches now produce diagnostics instead of silent fallback.

## ADR-0006 — Generate tag identity without vendoring the parser

**Status:** Accepted

**Context:** A local tag shortlist creates incorrect name boundaries and drifts from Rockbox, while copying the GPL parser into the browser would cross the project's current licensing and architecture boundary.

**Decision:** Extract factual tag names, token identifiers, parameter specs, raw flags, and categories from a separately checked-out pinned Rockbox tree. Check in reproducible JSON with attribution and licensing-review notes. Use it only for registry queries and longest-name matching; preserve unmatched names generically.

**Consequences:** Official names track an exact upstream SHA and ordinary tests stay offline. Parameter metadata does not itself prove interpretation, rendering, editing, or official parser agreement, and generated output requires human licensing review before distribution assumptions are made.

## ADR-0007 — Gate features by verified device capability

**Status:** Accepted

**Context:** The core state accepted only `ipod_video`, while dimensions and feature surfaces were scattered as iPod-specific constants. The Video and Classic targets share LCD dimensions but differ in tuner capability.

**Decision:** Store a source-referenced device profile ID in project settings. Centralize dimensions, capabilities, supported screen files, alias migration, and feature queries under `rockbox/devices/`. Hide unsupported authoring surfaces without deleting preserved project data.

**Consequences:** Existing projects migrate safely, target selection controls canvas geometry and minimal FM/touch/screen-file gates, and identical dimensions no longer imply identical capabilities. New profiles require source evidence and verification rather than UI conditionals.

## ADR-0008 — Use upstream CheckWPS as an external reference oracle

**Status:** Accepted

**Context:** Browser-only fixtures cannot establish agreement with Rockbox, while embedding or translating the GPL parser would cross the current licensing boundary. Rockbox already provides a target-specific validation program that links its real skin engine.

**Decision:** Build upstream `tools/checkwps` unchanged in an external SHA-and-target directory, invoke it as a development-time process, and compare its results with browser preservation and diagnostics. Keep category logic and checked-in reports in this repository, but never source, objects, or binaries from the official tool.

**Consequences:** Official differences and target dependence become visible without altering lossless future-syntax behavior. Local validation needs a matching Rockbox checkout and toolchain; ordinary tests remain offline. macOS may adjust only the generated out-of-tree makefile to select an available compiler.

## ADR-0009 — Separate public authored fixtures from private real themes

**Status:** Accepted

**Context:** Real themes are necessary compatibility evidence, but redistribution rights for locally obtained third-party files are not automatically established.

**Decision:** Commit only deterministic fixtures authored for this repository. Ignore private theme ZIPs and provenance sidecars, provide a helper that derives AMusicPod and Adwaitapod fixtures from a user-owned firmware tree, and check in reports that separate source preservation from semantic, visual, editing, and official-parser support.

**Consequences:** Ordinary validation stays self-contained and legally conservative while developers can reproduce real-theme evidence locally. A passing round trip cannot be advertised as full visual compatibility, and private fixtures must never be force-added without confirmed permission.

## ADR-0010 — Render a source-linked semantic operation list at native pixels

**Status:** Accepted

**Context:** The legacy AST and flat visual-element model cannot represent logic-aware WPS editing without weakening the lossless source-of-truth rule.

**Decision:** Interpret a documented WPS subset directly from the CST into device-independent render operations. Link every operation and layer to its source node, render at native device pixels with explicit clipping, and make DOM handles derived overlays. Preserve unsupported nodes as source-only/unsupported layers. When applied source is invalid, retain the last valid render and show the current diagnostics.

**Consequences:** Visual and source edits converge on the same document, conditionals retain logic context, and deterministic pixel goldens become possible. Browser fonts and the documented semantic subset remain approximations; support claims must continue to be tracked per construct rather than inferred from preservation.
