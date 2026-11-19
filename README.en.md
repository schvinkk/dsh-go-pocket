# dsh-go-pocket

[![check](https://github.com/schvinkk/dsh-go-pocket/actions/workflows/check.yml/badge.svg)](https://github.com/schvinkk/dsh-go-pocket/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh-go](https://img.shields.io/badge/dsh--go-%E2%89%A51.2.0-6E56CF.svg)](https://github.com/ccch1mneyyy/dsh-go-market)
[![upstream](https://img.shields.io/badge/upstream-dsh--pocket-informational.svg)](https://github.com/shaobeichen/dsh-pocket)

Brings [dsh-pocket](https://github.com/shaobeichen/dsh-pocket) (phone access) into the **dsh-go native phone UI**.

> [!IMPORTANT]
> **Not in the plugin market yet — install it manually.** The market only accepts packages published to npm, and this one is not there yet, so it will not show up in the app's plugin market. Manual install is two steps, see *Install* below. Restart the engine afterwards or nothing appears.

## Install in thirty seconds

```sh
git clone https://github.com/schvinkk/dsh-go-pocket.git
cd dsh-go-pocket && node bin/install.mjs
```

Then tap Restart once on the app's Engine page. Done.

Before: to see the LAN QR code, open the public tunnel or change the access PIN, you had to switch to the web client's *Settings → Phone access*. Now it is all on the phone: a status strip above the composer, and a panel with the QR codes, URLs, PINs and switches.

> This is a dsh-go **native plugin** (installed under `$DSH_HOME/dsh-go/plugins/`), not a Harness web plugin (Cordis bundle). It drives dsh-pocket's own control endpoints and keeps no second copy of the configuration.

## How it relates to upstream

**Upstream: [dsh-pocket](https://github.com/shaobeichen/dsh-pocket)** by shaobeichen, **GPL-2.0**, 3000+ stars. The LAN/public QR codes, access PINs, cloudflared tunnel, readiness self-heal and the proxy layer **all belong to upstream** — this project reimplements none of them.

This project does exactly one thing: **it gives upstream a remote-control panel on your phone.**

| | Upstream dsh-pocket | This project dsh-go-pocket |
| --- | --- | --- |
| Job | Actually implements phone access | Displays and drives it in the native UI |
| Installs into | the web plugin profile | `$DSH_HOME/dsh-go/plugins/` |
| Required? | **Yes** — without it this plugin does nothing | Optional, but nicer |
| Code relation | — | zero copies, zero imports, zero deps |
| Talks via | — | HTTP `POST /dsh-pocket/<endpoint>` |
| License | GPL-2.0 | MIT |

**Three things worth knowing:**

1. **dsh-pocket must be installed and enabled separately** (Phone access in the web settings). This project is a remote control, not a replacement; remove it and upstream keeps working untouched.
2. **No upstream source code is included.** Measured code overlap is 1.31%, and `lib/view.js` plus `lib/words.js` are at 0% — the overlapping parts are generic idioms like `JSON.parse` and `content-type`, plus field names that reading the same `settings.json` makes unavoidable.
3. **Why MIT is fine:** calling a separate program over HTTP is not a derivative work under the GPL. If anyone ever copies upstream code into this repository, **the whole package must become GPL-2.0**. That red line lives in [NOTICE.md](NOTICE.md).

> Crediting upstream is about respect and honesty, not a GPL obligation. The QR codes, tunnel and self-heal are shaobeichen's work; this project just added a panel for them.

Full licensing rationale, the measured overlap data and guidance for downstream users: **[NOTICE.md](NOTICE.md)**.

## Before you install

| Needs | Detail |
| --- | --- |
| dsh-go app | ≥ 1.2.0 (native plugins use bridge protocol v1) |
| dsh-pocket | installed and enabled on the same machine |
| Engine | running on `127.0.0.1` |

## Install

```sh
git clone https://github.com/schvinkk/dsh-go-pocket.git
cd dsh-go-pocket
node bin/install.mjs
```

The installer registers the profile dependency, adds the plugin to `dsh.profile.bundles`, and appends a plain insert to the profile's `cordis.patch.yml`.

**Restart the engine once from the app's Engine page afterwards.** Native plugins read their manifest at engine startup, so until you restart it stays invisible — that is not a broken plugin.

Equivalent manual steps:

```sh
P="$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
dsh plugin --profile web add "$P"
# then append to $DSH_HOME/profiles/web/cordis.patch.yml:
# - insert:
#     - id: dsh-go-pocket
#       name: dsh-go-pocket
```

After that, in dsh-go:

- a status strip above the composer reads *Phone access · LAN + public*; tap it for the main panel
- three panels under the session's Plugins tab / All features
- two composer chips: *LAN PIN* and *Public PIN*

## What you get

**Status strip** — one line telling you whether the phone can reach the engine (LAN / public / neither).

**Main panel**

- three metrics: local proxy, LAN access, public
- LAN QR code + URL + PIN, copy link / copy PIN in one tap
- public QR code + URL + PIN + tunnel mode, copy in one tap
- open / close the public tunnel with a confirmation, same disclaimer gate as the web client
- jump to *Tunnel & more*

**Access PIN panel** — both PINs, whether a fixed PIN is in use, rotate the LAN PIN, copy.

**Tunnel & more** — tunnel mode, self-heal state, mobile right-bar switch, engine port, restart engine, factory reset (all confirmed).

**Composer chips** — turn whatever is in the composer into a fixed PIN (8–64 alphanumerics). The most convenient way to change it on a phone: type it, then tap.

## How it connects

dsh-pocket mounts its control endpoints on the engine's own web server: `POST /dsh-pocket/<endpoint>`, gated by loopback plus the engine session cookie. This plugin runs in the same process, so it degrades in three steps:

1. `connection.authenticatedUrl()` gives a launch-token URL; one local `GET` trades it for the `dsh-auth-*` cookie
2. failing that, go through dsh-pocket's proxy port and trade the LAN PIN for a cookie
3. failing both, fall back to **read-only**: read state files under `$DSH_HOME/dsh-pocket/`. The panel still shows QR codes, URLs and PINs, but mutating buttons say plainly that changes are unavailable

No copied PIN files, no fake endpoints, no cached config. The state always matches the web client, because it reads the same source.

## Uninstall

```sh
dsh plugin --profile web remove dsh-go-pocket
rm -rf "$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
```

Then drop the insert from `cordis.patch.yml` (the installer leaves a backup at `cordis.patch.yml.bak-dsh-go-pocket-*`).

## Development

```sh
npm test                                                    # 12 unit tests
node "$DSH_HOME/skills/dsh-go-plugin/kit/bin/check.mjs" . --load --lang zh --app 1.2.0
```

`check.mjs` ships with the dsh-go app's dsh-go-plugin skill; exit code 0 means it passes. Changes under `lib/` need an engine restart.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

The plugin shows your LAN URL, public URL and access PIN on screen. Opening the public tunnel exposes an engine that can execute code to the internet — use a strong PIN and close it when you are done. **Redact URLs, PINs and QR codes in any screenshot before filing an issue.**

See [SECURITY.md](SECURITY.md).

## License

| Subject | License | Note |
| --- | --- | --- |
| This project | **MIT** | See [LICENSE](LICENSE). Commercial use, modification and redistribution allowed with attribution |
| Upstream dsh-pocket | **GPL-2.0** | Not included here, so no GPL conversion and no GPL text bundled |

**One red line**: copying upstream code into this repository makes the whole package GPL-2.0. Rationale and measurements in [NOTICE.md](NOTICE.md).

---

中文: [README.md](README.md)