# Phase 6 Rockbox-aware components

Phase 6 replaces the legacy flat “Add Element” palette with a versioned component system whose output is real Rockbox source and package assets.

## Component model

`rockbox/components/` separates the checked-in definition catalog from insertion and removal:

- A definition records its ID, version, category, preview, valid screens, target/capability requirements, required Rockbox tags, source template, binary assets, editable properties, insertion location, source complexity, and validation rules.
- An instance records the definition/version, screen, exact inserted source-node IDs, allocated image handle and viewport name, asset IDs/references, and property values.
- Imported source is never automatically converted into a component. Only an insertion made through the component engine receives instance metadata.

The initial catalog contains 19 definitions across all Phase 6 categories: battery, charging, playback, shuffle, repeat, volume, progress, time, metadata, album art, codec, playlist, next track, clock, status, touch, FM, and firmware list/menu treatment.

## Safe insertion

Insertion is one immutable `ProjectState` history update:

1. Refuse USB, unsupported screen files, unsupported targets, missing capabilities, or a source document with error diagnostics.
2. Allocate a deterministic component instance ID plus collision-free image handle and viewport name.
3. Validate numeric properties as finite whole numbers within the target screen and refuse off-screen geometry.
4. Reuse a generated asset only when both its intended archive path and content hash match. A conflicting imported path receives a numeric suffix and is never overwritten.
5. Render the definition template with typed property values.
6. Insert a source-only marker comment and source fragment using a stable node-ID prefix. Existing source bytes remain unchanged around the fragment.
7. Store binary component assets separately from imported package assets and merge them only at export.

The engine uses the existing whole-project history, so insert and remove are each a single undoable action.

## Conservative removal

Removal succeeds only when every recorded root source node is still present at its exact instance boundary. If the boundary was changed outside the component workflow, removal refuses to guess.

Generated assets are removed only when:

- no remaining component instance uses the asset ID; and
- no remaining WPS, SBS, or FMS source references the asset path.

Imported `ThemePackage` assets are never deleted by component removal. This preserves shared and handwritten references.

## Components mode

Components is a focused, lazy-loaded Pulp workspace rather than a small element popup. It provides:

- category browsing and visual previews;
- target/screen availability with visible restriction reasons;
- required capability, tag, asset, complexity, property, and validation details;
- editable insertion geometry;
- an exact instance list with safe removal;
- a quick Components entry from Screens.

List/menu components position firmware-owned UI viewports; they do not invent authored menu rows. USB remains firmware controlled. Touch remains visible but unavailable for both current non-touch iPod profiles.

## Official evidence

Regenerate the report with a matching external Rockbox checkout:

```bash
ROCKBOX_SOURCE_DIR=/path/to/rockbox npm run test:phase6-official
```

The runner uses target-specific external `checkwps` binaries for every available component/profile/screen combination. It writes `reports/phase6-components/latest.json` and bundles no Rockbox source or executable.

The checked report at commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31` records:

- 19 versioned component definitions;
- 53 available target/screen fixtures;
- 53 CheckWPS acceptances and zero rejections;
- both `ipodvideo` and `ipod6g`;
- one explicitly target-gated definition: touch input on the two non-touch profiles;
- exact source, asset, catalog, engine, and contract hashes.

Ordinary validation verifies this checked evidence offline:

```bash
npm run test:phase6
npm run phase6:component:report:verify
```
