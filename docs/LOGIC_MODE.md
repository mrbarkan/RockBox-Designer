# Logic Workspace

Logic is a dedicated, lazy-loaded Pulp-style workspace over the same lossless WPS/SBS/FMS documents and deterministic simulation state used by Screens and Play. It does not create a parallel rules format or flatten Rockbox conditionals into visual elements.

## Conditional tree and preview

Each `%?...<...>` source node appears in source order with its nesting depth, parent branch, exact expression, exact source block, branch count, active browser branch, and target capability status. Comments remain source-only and do not appear as conditions.

Branch labels for playback (`%mp`), repeat (`%mm`), language direction (`%Sr`), and common boolean tags come from the pinned Rockbox manual and skin-token implementation at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`. Other branches retain neutral numbered labels instead of guessed meaning.

Auto preview follows the shared simulator. A forced branch is disposable, per-screen UI state: it updates Screens and Logic together but never edits source. Logic exposes the same playback, repeat, hold, charging, power, USB, shuffle, direction, battery, and volume inputs as the Level A simulator, plus a direct handoff to Play.

## Source safety

Known conditions identify whether the browser interpreter can evaluate them. Unknown, malformed, target-unavailable, and future expressions remain exact and are labeled as preserved source. Unsupported or invalid tests receive no automatic branch; they can still be forced for visual inspection without claiming that the browser understands their real firmware behavior.

Reveal on canvas returns to the active screen and selects the source-linked conditional. Reveal in source opens the authoritative file and selects its stored source span.

The only structural write in this foundation is **Duplicate in source**. It explicitly appends a re-keyed copy of the chosen branch while retaining its siblings, separators, surrounding comments, newline style, and unknown tags. It requires confirmation and is unavailable for expressions the browser cannot evaluate. All other advanced edits remain in Source mode.

## Authority boundary

The browser evaluates only the documented conditional subset. Capability badges prevent an iPod Classic project from pretending that FM or touch state exists, but a preserved condition may still be valid for another target. The pinned external Rockbox simulator remains Level C authority for complete tag behavior, firmware state, and final pixels.
