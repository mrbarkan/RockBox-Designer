# Rockbox Designer
## Updated Product, UX, and Interface Guidelines
### Pulp-Inspired Browser Studio for Rockbox Themes

**Repository:** `mrbarkan/RockBox-Designer`
**Primary product reference:** Panic Playdate Pulp
**Secondary interaction reference:** Canva-style direct manipulation
**Technical foundation:** Lossless Rockbox source engine, target-aware renderer, deterministic package import/export
**Document role:** This document supplements `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md` and supersedes its earlier high-level interface assumptions wherever they conflict.

---

# 1. Purpose

Rockbox Designer should no longer be conceived primarily as “Canva for Rockbox.”

That description remains useful for one part of the product: selecting, dragging, resizing, aligning, arranging, and inserting visual presets. It is not the right model for the complete application.

The stronger product model is:

> **Pulp for Rockbox themes, with Canva-like manipulation inside the visual editing modes.**

Panic’s Pulp is a browser-based creative studio built around the particular constraints of the Playdate. Its value is not merely visual style. Its value is structural:

- Creation is divided into understandable modes.
- Each mode has purpose-built tools.
- The target platform’s limitations are visible.
- Visual creation is the default.
- Code remains available for advanced work.
- Previewing is immediate.
- The product feels compact, playful, and coherent.
- Users can make something useful without first understanding the whole platform.

Rockbox Designer should apply the same approach to Rockbox theming.

The core engineering requirements remain unchanged:

- Imported source must be preserved losslessly.
- Source remains authoritative.
- Visual state is a projection over source, not a replacement for it.
- Unsupported syntax must survive import, editing, saving, and export.
- Rockbox behavior must be target-aware.
- WPS, SBS, FMS, CFG, fonts, images, and iconsets must remain valid Rockbox artifacts.
- Simulation claims must be evidence-based.
- Firmware-controlled behavior must be clearly separated from standard theme capabilities.

This document changes the **product structure, workflow, and interface direction**, not the compiler architecture.

---

# 2. Product positioning

## 2.1 Primary positioning

> **Rockbox Designer is a browser-based studio for creating, editing, remixing, previewing, and exporting Rockbox themes.**

A user should be able to:

- Choose a Rockbox target.
- Start from a template or blank project.
- Import an existing theme ZIP.
- Design WPS, SBS, and FMS screens visually.
- Insert functioning Rockbox-aware components.
- Manage fonts, images, sprite strips, and iconsets.
- Preview conditional states.
- Inspect and edit source code when needed.
- Understand target limitations.
- Validate the project.
- Export an installable Rockbox theme.

## 2.2 Internal product formula

Use this formula for product decisions:

> **Pulp’s mode-based studio structure + Canva’s direct manipulation + Rockbox’s real parser and device rules**

### Pulp contributes

- Specialized modes
- Friendly constraints
- Compact browser studio
- Immediate playtesting
- Progressive disclosure
- Code as an advanced layer
- Platform-specific tools
- A coherent and playful identity

### Canva contributes

- Dragging and resizing
- Snapping and alignment
- Layers
- Property inspectors
- Visual component insertion
- Familiar direct manipulation
- Preset galleries

### Rockbox contributes

- Source syntax
- Device constraints
- Conditional logic
- Fonts and bitmap behavior
- Package structure
- Screen types
- Target capabilities
- Input and simulator behavior

Canva should not determine the application architecture. Rockbox Designer is a specialized authoring studio, not a general-purpose design product.

---

# 3. Product principles

## 3.1 Specialized modes, not one overloaded workspace

Do not expose every panel, screen, source file, simulation state, and asset tool at the same time.

Use clear creative modes.

Each mode should:

- Have one primary purpose.
- Show relevant tools only.
- Preserve project context.
- Keep the target device visible or accessible.
- Support undo and redo.
- Keep Play easy to reach.
- Link to source where relevant.
- Avoid generic controls that cannot be mapped safely to Rockbox.

## 3.2 Visual first, source always available

Beginners should be able to create a useful theme without manually writing Rockbox tags.

Advanced users must be able to:

- Inspect generated source.
- Edit imported source.
- Preserve custom constructs.
- Jump from canvas to source.
- Jump from source to canvas.
- Retain unsupported blocks.
- See diagnostics and target compatibility.

The source editor is not an emergency escape hatch. It is an advanced mode of the same studio.

## 3.3 Friendly constraints

Rockbox limitations should appear as design guidance, not obscure compiler errors.

Examples:

- “This target has no FM radio.”
- “Touch regions are unavailable on this player.”
- “This component requires a color display.”
- “This tag is preserved but is not rendered yet.”
- “USB is an SBS activity scene; the built-in logo remains a firmware fallback.”
- “This font contains more glyphs than recommended for this target.”
- “This quick-screen layout follows Rockbox’s built-in structure.”
- “This screen is influenced by SBS rather than independently skinned.”

Never imply that a capability exists when it does not.

## 3.4 Immediate preview

A permanent Play action should be easy to access throughout the application.

The expected loop is:

```text
Create → Play → Adjust → Play → Export
```

Preview is a core workflow, not a secondary inspector tab.

## 3.5 Constraints should encourage creativity

The target screen is not merely a generic rectangle. It has:

- Fixed resolution
- Color depth
- Font constraints
- Bitmap rules
- Memory limitations
- Input limitations
- Device capabilities
- Rockbox state behavior

The editor should make these constraints visible and useful.

## 3.6 Compact and coherent controls

Avoid enterprise-dashboard density.

Prefer:

- Compact icon tools
- Clear labels
- Small property groups
- Visual state controls
- Illustrated presets
- Contextual help
- Keyboard shortcuts
- Purposeful empty states
- Progressive disclosure

## 3.7 Source compatibility over visual convenience

When an operation cannot be represented safely:

- Disable it.
- Explain why.
- Offer a source-level alternative where possible.
- Preserve the project unchanged.

Never silently approximate or normalize unsupported behavior.

---

# 4. Top-level studio architecture

The intended top-level modes are:

```text
Theme
Screens
Components
Assets
Font
Logic
Source
Play
Export
```

The exact labels may evolve, but the separation of responsibilities should remain.

Recommended presentation:

- A compact top mode bar on desktop
- Keyboard-accessible numbered modes
- An icon-and-label navigation system
- A collapsible side navigation on narrower displays

Play should remain visually prominent.

---

# 5. Mode definitions

## 5.1 Theme mode

### Purpose

Configure project-wide settings and understand the selected device.

### Responsibilities

- Theme name
- Author
- Description
- Selected target
- Device capabilities
- Foreground and background colors
- Selector colors
- Global UI font
- Backdrop
- Iconset
- Viewer iconset
- Status bar behavior
- Scrollbar behavior
- Scroll settings
- Volume display
- Battery display
- Quick-screen assignments
- Package paths
- Compatibility summary

### Suggested layout

```text
┌──────────────────────┬────────────────────────────────┐
│ Device               │ Global appearance              │
│ Theme metadata       │ Colors                         │
│ Package files        │ Fonts                          │
│ Capabilities         │ UI behavior                    │
└──────────────────────┴────────────────────────────────┘
```

The selected target should show:

- Main screen dimensions
- Color depth
- Touch support
- FM support
- Remote display support
- Album-art support
- Relevant screen files
- Known target warnings

Do not make users discover basic target limitations after they have already designed an incompatible screen.

---

## 5.2 Screens mode

### Purpose

The primary visual editing environment.

This is the closest equivalent to Pulp’s Room mode and the place where Canva-style direct manipulation belongs.

### Screen selector

Show only supported screen types by default:

- WPS
- SBS
- FMS
- RWPS
- RSBS
- RFMS

An advanced setting may reveal unavailable types for inspection, but they must be visibly disabled or labeled.

### Suggested desktop layout

```text
┌─────────────────────────────────────────────────────────────────┐
│ Theme  Screens  Components  Assets  Font  Logic  Source   ▶ Play│
├───────────────┬─────────────────────────────┬───────────────────┤
│ Screens       │                             │ Inspector         │
│ WPS           │       DEVICE SCREEN         │                   │
│ SBS           │                             │ Position          │
│ FMS           │       Native pixels         │ Size              │
│               │       scalable zoom         │ Appearance        │
│ States        │                             │ Rockbox behavior  │
│ Playing       │                             │ Condition         │
│ Paused        │                             │ Source link       │
│ Charging      │                             │                   │
├───────────────┴─────────────────────────────┴───────────────────┤
│ Components: Battery  Progress  Album Art  Playback  Metadata +  │
└─────────────────────────────────────────────────────────────────┘
```

### Left panel

- Screen list
- State presets
- Logic-aware layer hierarchy
- Viewport tree
- Search
- Visibility
- Lock state
- Conditional branch selection

### Center canvas

The canvas must:

- Render at native target resolution.
- Scale with nearest-neighbor interpolation.
- Use integer coordinates.
- Support optional pixel grid and guides.
- Show viewport clipping.
- Support selection, dragging, resizing, and nudging where safe.
- Distinguish active and inactive conditional branches.
- Surface unsupported source blocks.
- Never become the independent source of truth.

### Right inspector

Show only properties that can be represented safely.

Possible groups:

- Position
- Size
- Viewport
- Alignment
- Font
- Color
- Metadata
- Image path
- Sprite behavior
- Bar behavior
- Condition
- Touch action
- Source location
- Compatibility

### Bottom component strip

Provide quick insertion of common components without requiring a full mode change.

### Source relationship

Every selectable object must correspond to one of:

- A source node
- A semantic node derived from source
- A generated component instance
- An editor-only grouping construct
- A source-only unsupported block

---

## 5.3 Components mode

### Purpose

Browse, preview, customize, save, and insert Rockbox-aware interface components.

A component is not just an image or SVG.

It may contain:

- Rockbox source
- Viewports
- Conditions
- Preloaded image handles
- Bitmap assets
- Font dependencies
- Target requirements
- Editable properties
- Validation rules
- Simulation behavior

### Categories

#### Battery

- Numeric percentage
- Simple bar
- Segmented bar
- Five-frame strip
- Ten-frame strip
- Charging state
- External-power state
- Low-battery warning

#### Playback

- Play/pause icon
- Play/pause/stop group
- Transport group
- Text status
- Animated state strip
- Seek states

#### Progress

- Thin
- Thick
- Segmented
- Bitmap-based
- Time plus progress
- Remaining-time display

#### Volume

- Numeric
- Decibels
- Percentage
- Horizontal bar
- Overlay
- Temporary volume-change display
- Muted state

#### Album art

- Square
- Cropped
- Full bleed
- Left column
- Right column
- Background
- Missing-art fallback

#### Metadata

- Title
- Artist
- Album
- Track number
- Playlist position
- Codec
- Bitrate
- Frequency
- Next track
- Filename
- Path

#### Status

- Clock
- Battery
- Volume
- Shuffle
- Repeat
- Hold
- USB
- Disk activity

#### FM

- Frequency
- Preset
- Stereo
- Signal strength
- RDS name
- RDS text

#### Lists and menus

- List title
- Selected row
- Scrollbar
- Icons
- Quick-setting labels
- Quick-setting values

### Component card content

Each card should display:

- Preview
- Name
- Category
- Compatible targets
- Required capabilities
- Included assets
- Editable properties
- Source complexity
- Validation level

### Insertion requirements

Insertion must:

- Allocate safe identifiers and handles.
- Avoid viewport-name collisions.
- Add required assets.
- Add or reuse fonts.
- Preserve source ordering rules.
- Insert conditions safely.
- Support undo.
- Report conflicts.
- Refuse unsafe insertion.

### Custom components

Later, users may save selected groups as personal components.

Do not implement public sharing until the component format is stable and versioned.

---

## 5.4 Assets mode

### Purpose

Manage the project as an actual Rockbox package.

### Asset types

- Bitmap
- Sprite strip
- Backdrop
- Font
- Iconset
- Viewer iconset
- Album-art fallback
- Source file
- Unknown binary
- Generated asset

### Features

- Thumbnail view
- List view
- Archive-path view
- Native-size preview
- Usage count
- Referenced-by list
- Missing-reference detection
- Duplicate-basename warnings
- Pixel dimensions
- Color-depth information
- Sprite-frame preview
- Replace asset
- Rename with safe source updates
- Delete with reference checks
- File hash
- Export path
- Conversion warnings

### Storage rule

Binary bytes remain canonical.

Object URLs, decoded images, thumbnails, and previews are derived UI state.

### Rockbox-specific warnings

- Unsupported file type
- Color-depth mismatch
- Excessive dimensions
- Missing reference
- Duplicate path
- Duplicate basename
- Sprite count mismatch
- Asset excluded from export
- Font referenced but missing

---

## 5.5 Font mode

### Purpose

Treat fonts as a first-class creative subsystem.

This is directly inspired by Pulp’s dedicated Font mode.

### Features

- Browse bundled Rockbox fonts
- Import `.fnt`
- Upload TTF or OTF
- Select pixel size
- Select glyph ranges
- Preview glyph grid
- Preview current project strings
- Detect missing glyphs
- Show exact string widths
- Compare sizes
- Preview line heights
- Preview on the active device
- Generate `.fnt`
- Add font to package
- Rename safely
- Show all source references
- Warn about licensing
- Show memory and file-size guidance

### Future glyph editor

Possible later features:

- Pixel-level glyph editing
- Baseline control
- Advance width
- Character mapping
- Import and export

Do not build a manual glyph editor before `.fnt` parsing, metrics, and rendering are reliable.

### Conversion sequence

1. Native helper prototype
2. Reproducible converter wrapper
3. Optional WebAssembly research
4. Browser workflow

Do not promise browser-only conversion before verification.

---

## 5.6 Logic mode

### Purpose

Make Rockbox conditionals and state-driven behavior understandable.

Avoid a generic node graph unless user research proves it necessary.

### Preferred representation

```text
WPS
├── Always
│   ├── Album art
│   ├── Title
│   └── Progress
├── Playback status
│   ├── Playing
│   │   └── Play icon
│   ├── Paused
│   │   └── Pause icon
│   └── Stopped
│       └── Stop icon
├── Volume changed recently
│   └── Volume overlay
└── Hold active
    └── Hold indicator
```

### Features

- Conditional tree
- Branch selection
- Human-readable labels
- Raw expression
- State simulation
- Source links
- Target compatibility
- Unsupported-expression preservation
- Insert common conditions
- Duplicate branch
- Reveal on canvas
- Reveal in source

### Beginner representation

```text
Show this component when:
[ Playback status ] [ is ] [ Paused ]
```

### Advanced representation

```text
%?mp<...>
```

### Safety rule

Do not simplify a complex imported conditional unless the conversion is exact and reversible.

Otherwise display:

```text
Advanced source condition
Preserved exactly
Edit in Source mode
```

---

## 5.7 Source mode

### Purpose

Provide a capable source editor for experienced Rockbox authors and transparent access to generated code.

### Files

- CFG
- WPS
- SBS
- FMS
- Remote-screen files
- Generated fragments where appropriate

### Features

- Syntax highlighting
- Inline diagnostics
- Line and column display
- Tag autocomplete
- Hover documentation
- Target compatibility hints
- Snippets
- Search and replace
- Reveal on canvas
- Reveal selected source node
- Source diff
- Undo and redo
- Unsupported-tag indicators
- Official parser status when available
- Explicit formatting command

### Invalid source behavior

When source becomes invalid:

- Preserve the text.
- Show diagnostics.
- Keep the last successfully interpreted preview.
- Mark that preview as stale.
- Do not auto-correct without consent.
- Do not discard invalid edits.

### Generated source behavior

Generated source remains editable.

After manual edits:

- Reparse
- Preserve changes
- Update semantic interpretation
- Update canvas where possible
- Disable only the unsafe controls

---

## 5.8 Play mode

### Purpose

Provide immediate, central, interactive preview.

Play is a first-class mode.

### Initial simulator

The first implementation is a deterministic browser state simulator using the application renderer.

Support:

- Play
- Pause
- Stop
- Seek
- Track changes
- Metadata changes
- Long scrolling strings
- Album-art changes
- Missing album art
- Volume
- Volume-change overlay
- Battery level
- Charging
- External power
- Hold
- USB inserted
- Shuffle
- Repeat
- Clock
- Disk activity
- FM
- RDS
- Touch where supported
- Remote LCD where supported

### Suggested layout

```text
┌──────────────────────────────────────────────┐
│ ◀ Edit       iPod Video        Scenario ▾   │
├──────────────────────────────────────────────┤
│                                              │
│             INTERACTIVE DEVICE               │
│                                              │
├──────────────────────────────────────────────┤
│ ▶ 00:42 / 04:18     Volume 72%     Battery 64│
│ [Playing] [Paused] [Charging] [Hold] [USB]   │
└──────────────────────────────────────────────┘
```

### Scenario presets

- Normal playback
- Paused
- Stopped
- Low battery
- Charging
- USB connected
- Hold active
- Volume overlay
- Missing album art
- Long metadata
- FM tuned
- Weak signal
- RTL text
- Remote display

### Simulation levels

#### Level A — Browser state simulator

Fast and always available.

#### Level B — Official skin-engine validation

Use official behavior where feasible.

#### Level C — Full Rockbox system simulator

Run an actual target simulator through browser, native helper, or hosted integration.

The interface must state which level is active.

---

## 5.9 Export mode

### Purpose

Validate, explain, and package the project.

### Sections

#### Summary

- Theme name
- Target
- Included screens
- Fonts
- Assets
- Package size

#### Validation

- Browser parser
- Missing assets
- Target compatibility
- Unknown tags
- Unsupported rendering
- Official parser status
- Firmware-mode requirements

#### Export type

- Standard Rockbox theme
- Project source archive
- Compatibility report
- Firmware Mode package, later

#### Manifest

Display every output path.

#### Severity language

- Error
- Warning
- Information
- Preserved but not interpreted

Never claim “fully compatible” without a documented official validation process for the selected target and supported subset.

---

# 6. Global studio shell

## 6.1 Desktop layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Rockbox Designer     Project Name                    Save   ▶ Play  │
├────────────────────────────────────────────────────────────────────┤
│ Theme  Screens  Components  Assets  Font  Logic  Source  Export    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                      ACTIVE MODE WORKSPACE                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Header

- Project name
- Save state
- Undo
- Redo
- Target
- Play
- Export
- Project menu
- Help

### Mode bar

- Fast switching
- Active mode
- Keyboard hints
- Small error or warning badges

## 6.2 Responsive behavior

The editor is primarily a desktop product.

On narrow displays:

- Collapse mode labels.
- Use drawers for secondary panels.
- Keep Play visible.
- Do not pretend full authoring is comfortable on a phone.

## 6.3 Visual tone

Aim for:

- Compact
- Cheerful
- Precise
- Slightly nostalgic
- Hardware-aware
- Tool-like
- Friendly without being childish

Possible influences:

- Playdate Pulp
- Early Mac creative tools
- Pixel editors
- Music hardware
- Braun-like clarity
- Rockbox’s enthusiast culture

Avoid:

- Generic SaaS dashboards
- Large decorative cards
- Excessive glassmorphism
- Dense video-editor chrome
- Decorative gradients without purpose
- Canva imitation that erases Rockbox identity

---

# 7. Progressive disclosure

## 7.1 Beginner surface

Prioritize:

- Theme
- Screens
- Components
- Play
- Export

Keep advanced tools accessible but less dominant:

- Logic
- Source
- Detailed compatibility

## 7.2 Advanced surface

Optional advanced overlays and tools:

- Raw tag names
- Source spans
- Conditional expressions
- Render operations
- Viewport clipping
- Unsupported nodes
- Asset paths
- Official validation
- Device capabilities
- Firmware Mode

## 7.3 No fake simplicity

Hidden advanced constructs remain in the project.

Beginner mode must never discard or rewrite them.

---

# 8. Direct manipulation

## 8.1 Selection

- Click selects.
- Shift-click adds to selection.
- Click empty canvas clears selection.
- Double-click opens element-specific editing.
- Source-only blocks may be selected with limited controls.

## 8.2 Dragging

- Integer-pixel movement
- Optional grid snapping
- Alignment guides
- Native coordinates
- Source-aware update command
- Undoable operation

## 8.3 Resizing

Expose resize controls only where Rockbox semantics support geometry:

- Viewports
- Album-art rectangles
- Bars
- Touch regions
- Explicitly positioned images

Do not expose generic resizing for source tags without geometry.

## 8.4 Alignment

Potential tools:

- Left
- Center
- Right
- Top
- Middle
- Bottom
- Distribute
- Match width
- Match height

Verify that each action is source-safe before implementation.

## 8.5 Grouping

Distinguish:

### Temporary visual multi-selection

Editor interaction only.

### Persistent component group

A logical relationship among source nodes and assets.

Do not invent export semantics for generic groups.

## 8.6 Layers

The layer panel must reflect logic and source behavior.

Show:

- Viewports
- Drawing order
- Conditional groups
- Branches
- Image preloads
- Editor component groups
- Source-only blocks
- Unsupported nodes

Do not imply that source order is identical to conventional z-index.

---

# 9. Keyboard guidelines

Suggested global shortcuts:

```text
1–9                 Switch modes
Cmd/Ctrl+P          Play
Cmd/Ctrl+S          Save
Cmd/Ctrl+E          Export
Cmd/Ctrl+Z          Undo
Cmd/Ctrl+Shift+Z    Redo
Delete/Backspace    Delete selected editable object
Arrow keys          Nudge one pixel
Shift+Arrow         Nudge ten pixels
G                   Toggle grid
R                   Toggle guides
L                   Toggle layer panel
I                   Toggle inspector
/                   Search commands
Escape              Leave current tool or selection
```

Suggested Screens shortcuts:

```text
V                   Select
T                   Insert text or metadata
I                   Insert image
B                   Insert bar
A                   Insert album art
C                   Open component picker
Option/Alt-drag     Duplicate
[ and ]             Previous or next state
```

Requirements:

- No conflict with typing in Source mode.
- Tooltips show shortcuts.
- Every shortcut has a visible equivalent.

---

# 10. Onboarding and empty states

## 10.1 New project

Ask:

1. Which device?
2. Blank or template?
3. Which screens?
4. Which visual direction?

Do not show every CFG field immediately.

## 10.2 Imported project

After import, summarize:

- Detected target
- Files found
- Missing assets
- Unknown tags
- Screens
- Compatibility
- Preserved source-only content

Primary actions:

- Open Screens
- Review Source
- Play Theme

## 10.3 Empty screen

Example:

```text
This WPS is empty.

Start with:
[ Minimal player ]
[ Album art layout ]
[ Text-only layout ]
[ Import source block ]
```

## 10.4 Unsupported content

Example:

```text
Advanced Rockbox source

This block is preserved exactly but is not yet rendered visually.

[ Reveal in Source ]
[ View raw code ]
```

---

# 11. Templates

Suggested starters:

- Minimal text player
- Classic iPod-inspired player
- Full album-art player
- Tiny monochrome player
- Information-dense player
- FM screen starter
- Status-bar starter
- Touchscreen player
- Remote-screen starter

Each template must:

- Use valid source.
- Include necessary assets only.
- Explain key components.
- Support the selected target.
- Pass the current validation level.
- Be visually editable.
- Avoid unlicensed third-party assets.

---

# 12. Compatibility language

Use multiple support states:

```text
Preserved
Parsed
Interpreted
Rendered
Editable
Officially validated
```

Example:

```text
%St
Preserved: Yes
Parsed: Yes
Interpreted: Partial
Rendered: No
Editable: No
Officially validated: Yes
```

Do not use a single compatibility percentage.

Good:

> This theme is preserved and exportable. Three tags are not rendered in the current preview.

Bad:

> Compatibility: 92%

---

# 13. Theme Mode and Firmware Mode

## 13.1 Theme Mode

Standard Rockbox theme files:

```text
.cfg
.wps
.sbs
.fms
.rwps
.rsbs
.rfms
.bmp
.fnt
iconset assets
```

Only export supported files that actually exist or were intentionally created.

## 13.2 Firmware Mode

Optional later features for behavior compiled into Rockbox:

- Built-in USB fallback logo and placement beyond the SBS-authored scene
- Built-in icons
- Deeper quick-screen changes
- System dialogs
- Additional skin hooks
- Simulator modifications

### UI rule

Every firmware-only feature must display:

```text
Requires custom firmware
```

Do not hide this distinction.

Do not export fictional standard theme formats.

---

# 14. Updated implementation sequence

Do not interrupt unfinished source-engine work.

## Foundation first

1. Lossless parser
2. Source-aware editing
3. CFG and ZIP pipeline
4. Tag registry
5. Device profiles
6. Official validation bridge
7. Real-theme fixtures

## Studio migration

8. Pulp-inspired studio shell
9. Theme mode migration
10. Screens mode migration
11. Source mode migration
12. Assets mode migration
13. Play mode migration
14. Export mode migration

## Creative modes

15. Components mode
16. Logic mode
17. Font mode
18. SBS and menu expansion
19. FMS expansion
20. Templates and onboarding

## Advanced work

21. Official rendering comparison
22. Expanded device-state simulation
23. Full simulator research
24. Optional Firmware Mode

---

# 15. Codex rules for the UX migration

## 15.1 Do not migrate early

Do not begin the complete mode migration while:

- Source parsing is lossy.
- Imported themes can be corrupted.
- Assets are unreliable.
- Device dimensions are hardcoded.
- Visual edits bypass source-aware commands.

## 15.2 Use focused pull requests

Recommended:

```text
PR 1 — Studio shell and mode navigation
PR 2 — Theme mode migration
PR 3 — Screens mode migration
PR 4 — Source mode migration
PR 5 — Assets mode migration
PR 6 — Play mode migration
PR 7 — Export mode migration
PR 8 — Components mode foundation
PR 9 — Logic mode foundation
PR 10 — Font mode foundation
```

Each PR must preserve existing behavior.

## 15.3 Avoid duplicate editors

When functionality moves:

- Remove or deprecate the old panel.
- Do not leave conflicting controls.
- Preserve shortcuts.
- Update tests and documentation.

## 15.4 State ownership

Project data remains global.

Mode-specific transient state may include:

- Active screen
- Selected asset
- Selected logic branch
- Font preview string
- Simulation scenario
- Source cursor

Do not duplicate project state per mode.

## 15.5 Keep Play accessible

Every creative mode should expose Play.

## 15.6 Future deep links

Design state so later routes are possible:

```text
/screens/wps
/assets/battery.bmp
/source/wps?line=42
/logic/node/<id>
/play?scenario=charging
```

Routing does not need to be added in the first shell PR.

---

# 16. Suggested component model

```ts
export type ComponentSupport = {
  requiredTags: string[];
  requiredCapabilities: string[];
  supportedTargets?: string[];
  unsupportedTargets?: string[];
};

export type RockboxComponentDefinition = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  previewAsset: string;
  sourceTemplate: string;
  includedAssets: ComponentAsset[];
  properties: ComponentProperty[];
  support: ComponentSupport;
  insertionRules: InsertionRule[];
  validationRules: ValidationRule[];
};
```

A component instance should retain:

- Definition ID
- Version
- Source node IDs
- Asset IDs
- Property values
- Editor metadata

Do not automatically convert imported source into a built-in component unless the match is exact and reversible.

---

# 17. Suggested simulation model

```ts
export type SimulationState = {
  playback: {
    status: "stopped" | "playing" | "paused" | "ffwd" | "rew";
    elapsedSeconds: number;
    durationSeconds: number;
  };

  track: {
    title: string;
    artist: string;
    album: string;
    trackNumber?: number;
    albumArtAssetId?: string;
    codec?: string;
    bitrate?: number;
  };

  audio: {
    volume: number;
    volumeChangedAt?: number;
    shuffle: boolean;
    repeat: "off" | "all" | "one" | "shuffle";
  };

  power: {
    batteryPercent: number;
    charging: boolean;
    externalPower: boolean;
  };

  device: {
    hold: boolean;
    usbInserted: boolean;
    diskActivity: boolean;
  };

  clock: {
    timestamp: number;
  };

  fm?: {
    frequency: number;
    tuned: boolean;
    stereo: boolean;
    signal: number;
    presetName?: string;
    rdsName?: string;
    rdsText?: string;
  };
};
```

Scenarios should be deterministic, serializable, and shareable.

---

# 18. Visual design direction

Do not finalize visual styling before validating the studio structure.

Initial guidelines:

- Strong contrast
- Compact spacing
- Crisp panel boundaries
- Limited radius system
- Clear selection state
- Minimal shadows
- One primary accent
- Pixel-aware icons where appropriate
- Device screen remains visually dominant
- Avoid unnecessary animation

A future studio theme may support light and dark appearances, but this must not delay the core editor.

---

# 19. Definition of product success

Rockbox Designer succeeds when:

1. A real Rockbox theme opens without source loss.
2. The tool explains the theme visually and logically.
3. Common edits do not require memorizing Rockbox syntax.
4. Advanced source remains intact and editable.
5. Preview reacts immediately to device states.
6. Export is valid and deterministic.
7. Device limitations are clear.
8. The interface feels coherent and approachable.
9. Experimentation is fast.
10. The compiler architecture remains invisible to users who do not need it.

The goal is to make Rockbox theming feel smaller and friendlier without making the engine less rigorous.

---

# 20. Codex execution prompt

Use this after the source-engine work is sufficiently stable:

> Read `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md`, `ROCKBOX_DESIGNER_PULP_UX_GUIDELINES.md`, the repository `AGENTS.md`, and `docs/IMPLEMENTATION_STATUS.md`. Preserve the lossless source architecture and all parser, package, device, and compatibility acceptance criteria. Treat Panic Playdate Pulp as the primary product-structure reference: a compact browser studio composed of specialized creative modes. Treat Canva only as a reference for direct manipulation inside Screens mode. Do not build one overloaded canvas workspace. Introduce the studio shell incrementally, keep Play prominent, keep Source accessible, expose Rockbox constraints clearly, and never represent firmware-controlled behavior as standard theme functionality. Execute only the requested milestone, preserve unrelated changes, add tests, update documentation, run validation, and prepare a focused draft pull request.

---

# 21. Immediate next action

Do not stop or replace current Codex work if it is completing the parser, package, device-profile, or validation foundation.

Add this document to the repository and update the main execution status with:

```text
UX direction updated:
- Pulp-inspired specialized studio modes
- Canva-style direct manipulation concentrated in Screens mode
- Play elevated to a first-class workflow
- Source remains authoritative
- Rockbox constraints remain explicit
```

The first UX migration should begin only after imported themes can be preserved and edited safely.
