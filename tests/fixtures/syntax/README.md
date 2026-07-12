# Syntax Fixtures

`roundTripFixtures.ts` contains authored, synthetic Phase 1A fixtures for exact source preservation. It covers plain text, comments, blank lines, LF and CRLF, Unicode, tag invocation styles, escapes, unknown tags, nested and parameterized conditionals, empty branches, images, viewports, bars, touch regions, album art, and malformed source.

These fixtures prove the browser engine's preservation contract for the tested inputs. They are not evidence of complete Rockbox compatibility. Real third-party themes and official parser comparison are deferred to Phases 1F and 1G.
