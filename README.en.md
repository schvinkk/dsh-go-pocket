# dsh-go-pocket

[dsh-pocket](https://github.com/shaobeichen/dsh-pocket) (phone access) inside the **dsh-go phone app's native UI**.

Opening a public tunnel, scanning the LAN QR code or rotating an access PIN used to mean switching to the web settings page. With this plugin it all lives in the app: one status strip above the composer, one panel with QR codes, addresses, PINs and switches.

> This is a dsh-go **native plugin** (`$DSH_HOME/dsh-go/plugins/`), not a Harness web plugin (Cordis bundle). It drives dsh-pocket's own control endpoints and keeps no second copy of the configuration.

## What it is built on

**Upstream: dsh-pocket** — https://github.com/shaobeichen/dsh-pocket by shaobeichen, **GPL-2.0**.

The LAN/public QR codes, access PINs, cloudflared tunnel, readiness self-heal and the proxy layer all come from upstream. This plugin is an **adapter**: it shows and drives that same state from the dsh-go native UI.

- It contains **no upstream source code** — it only calls `POST /dsh-pocket/<endpoint>`;
- **dsh-pocket must be installed separately** (`dsh plugin --profile web add dsh-pocket`); this plugin is a remote control, not a replacement;
- This plugin itself is MIT; merging upstream code into this repository makes the whole package GPL-2.0. See [NOTICE.md](NOTICE.md).

## Before you install

- dsh-go app 1.2.0 or newer (native plugin bridge v1)
- `dsh-pocket` installed and enabled on the same machine
- the engine running on `127.0.0.1`

## Install

```sh
npx dsh-go-pocket
# or from a source checkout
node bin/install.mjs --dir /path/to/dsh-go-pocket
```

The installer registers the profile dependency, adds the plugin to `dsh.profile.bundles`, and appends a plain insert to the profile's `cordis.patch.yml` so the engine mounts it without a restart.

Manual equivalent:

```sh
P="$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
dsh plugin --profile web add "$P"
# then append to $DSH_HOME/profiles/web/cordis.patch.yml:
# - insert:
#     - id: dsh-go-pocket
#       name: dsh-go-pocket
```

## What you get

- **Status strip** above the composer: LAN / public / neither, in one line.
- **Phone access panel**: proxy, LAN and public metrics; LAN QR code, address and PIN; public QR code, URL, PIN and tunnel mode; copy buttons; open/close public access behind a confirm.
- **Access PIN panel**: both PINs, whether each is fixed, rotate the LAN PIN, copy either.
- **Tunnel & more**: tunnel mode, readiness self-heal state, mobile right bar, engine port, restart engine, factory reset (both confirmed).
- **Composer actions**: turn whatever you typed into a fixed PIN (8–64 letters or digits).

## How it connects

dsh-pocket mounts its control surface on the engine's own web server: `POST /dsh-pocket/<endpoint>`, guarded by loopback plus the engine session cookie. This plugin runs in the same process, so it

1. asks `connection.authenticatedUrl()` for the launch-token URL and exchanges it for a `dsh-auth-*` cookie on loopback;
2. falls back to dsh-pocket's proxy port with the LAN PIN;
3. falls back to read-only: it reads the state files under `$DSH_HOME/dsh-pocket/` and every mutating button says so.

No PIN files are copied, no endpoint is faked, no configuration is duplicated.

## Uninstall

```sh
dsh plugin --profile web remove dsh-go-pocket
rm -rf "$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
```

Then drop the insert from `cordis.patch.yml` (the installer leaves a `cordis.patch.yml.bak-dsh-go-pocket-*` backup).

## Development

```sh
node "$DSH_HOME/skills/dsh-go-plugin/kit/bin/check.mjs" . --load --lang zh
```

`lib/` changes need an engine restart from the app's Engine page; `package.json` manifest edits are re-read automatically.

## License

MIT. dsh-pocket itself is GPL-2.0; this plugin contains none of its code and only calls its HTTP endpoints.