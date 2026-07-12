# Rockbox Designer — Agent Instructions

## Product contract

Rockbox Designer is a browser-based visual editor for Rockbox themes. The original Rockbox source is authoritative. Visual state is a projection over a lossless source document.

## Required behavior

- Preserve unknown, unsupported, malformed, and future Rockbox syntax.
- Untouched source must round-trip exactly.
- Do not guess Rockbox behavior; consult current Rockbox source and record the upstream commit SHA.
- Keep syntax parsing, semantic interpretation, rendering, editing, validation, and ZIP packaging separate.
- Do not flatten imported themes into only visual elements.
- Do not represent USB or full quick-screen redesign as standard theme functionality without source verification.
- Do not vendor GPL Rockbox code without an explicit licensing decision.
- Avoid unrelated UI refactors during core-engine work.
- Follow the phase boundaries and stop conditions in `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md`.

## Validation before every pull request

Run:

```bash
npm run typecheck
npm test
npm run build
```

Run fixture, package, or visual-regression commands when the changed area provides them.

## Git and documentation

- Preserve unrelated user changes.
- Use focused branches and commits.
- Update `docs/IMPLEMENTATION_STATUS.md`.
- Add an ADR entry in `docs/DECISIONS.md` for architectural changes.
- Document unsupported behavior instead of hiding it.
