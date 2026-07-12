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
