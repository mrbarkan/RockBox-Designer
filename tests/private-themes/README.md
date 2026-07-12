# Private Theme Fixtures

Place legally obtained third-party theme ZIPs here. Everything in this directory except this README is ignored by Git.

AMusicPod and Adwaitapod can be prepared from an existing user-owned Rockbox firmware directory without copying them into the repository:

```bash
npm run themes:prepare-private -- --firmware-dir=/absolute/path/to/rockbox-firmware
npm run test:themes
```

The helper creates `AMusicPod.zip`, `Adwaitapod.zip`, and private provenance sidecars. Do not force-add them. Confirm redistribution rights independently before changing a theme from `private-local` to a committed public fixture.

Additional ZIPs may be added manually. Add a sibling `<theme>.zip.provenance.json` with `name`, `target`, `sourceClass`, `source`, and redistribution notes so aggregate reports remain traceable.
