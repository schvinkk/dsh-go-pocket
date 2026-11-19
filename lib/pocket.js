// 与 dsh-pocket 通信。
//
// dsh-pocket 把控制接口挂在引擎 Web 服务器的 `/dsh-pocket/<endpoint>` 上
// （loopback + 引擎会话 cookie 双重门禁）。本插件和 dsh-pocket 跑在同一个进程里，
// 所以不需要访问密码，只要拿到一次引擎会话 cookie：
//
//   1) 首选：connection.authenticatedUrl() 给出带 launch token 的入口地址，
//      本机 GET 一次就换回 dsh-auth-* cookie（不读任何密码文件）；
//   2) 备选：走 dsh-pocket 代理端口，用局域网密码换 cookie；
//   3) 都拿不到：退化成只读——直接读 $DSH_HOME/dsh-pocket 下的状态文件。
//
// 任何一步失败都不抛给 App：面板显示「未连上」，改动类操作回一句人话提示。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, networkInterfaces } from 'node:os'
import { connect } from 'node:net'

const DEFAULT_PORT = 3080
const PROXY_FALLBACK_PORT = 3081
const BOOTSTRAP_TTL_MS = 5 * 60_000

export const ENDPOINTS = Object.freeze({
  status: 'pocket.status',
  tunnelStart: 'tunnel.start',
  tunnelStop: 'tunnel.stop',
  tunnelSetConfig: 'tunnel.setConfig',
  version: 'pocket.version',
  update: 'pocket.update',
  restart: 'pocket.restart',
  lanTokenRefresh: 'token.lanRefresh',
  lanAuthSetEnabled: 'lanAuth.setEnabled',
  lanSetOverride: 'lan.setOverride',
  lanSetEnabled: 'lan.setEnabled',
  rightbarSetEnabled: 'mobile.rightbar.setEnabled',
  pinSetCustom: 'pin.setCustom',
  reset: 'pocket.reset',
})

const home = () => process.env.DSH_HOME ?? join(homedir(), '.dsh')
const pocketDir = () => join(home(), 'dsh-pocket')

function readJson(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    return raw && typeof raw === 'object' ? raw : undefined
  } catch {
    return undefined
  }
}

function readPinFile(name) {
  try {
    return readFileSync(join(pocketDir(), name), 'utf8').trim()
  } catch {
    return ''
  }
}

/** 设置文件（和 dsh-pocket 自己的 settings.mjs 读的是同一份）。 */
export function localSettings() {
  return readJson(join(pocketDir(), 'settings.json')) ?? {}
}

/** settings.json 的实时读取：dsh-pocket 每次调用都重读文件，本插件同样不缓存。 */
export function readSettingsNow() {
  const s = localSettings()
  const pin = (k) => s[k] === true
  return {
    lanEnabled: s.lanEnabled !== false,
    lanAuthEnabled: s.lanAuthEnabled !== false,
    mobileRightbarEnabled: s.mobileRightbarEnabled !== false,
    lanIpOverride: typeof s.lanIpOverride === 'string' ? s.lanIpOverride : '',
    tunnelMode: s.tunnelMode === 'named' ? 'named' : 'quick',
    tunnelHostname: typeof s.tunnelHostname === 'string' ? s.tunnelHostname : '',
    tunnelTokenSet: typeof s.tunnelToken === 'string' && s.tunnelToken.length > 0,
    proxyPort: Number.isInteger(s.proxyPort) && s.proxyPort > 0 ? s.proxyPort : PROXY_FALLBACK_PORT,
    publicPinCustom: pin('publicPinCustom'),
    lanPinCustom: pin('lanPinCustom'),
    installedFiles: existsSync(join(pocketDir(), 'settings.json'))
      || existsSync(join(pocketDir(), 'token'))
      || existsSync(join(pocketDir(), 'token-lan')),
  }
}

export function localPins() {
  return { lan: readPinFile('token-lan'), public: readPinFile('token') }
}

/** 本机非回环 IPv4 地址（局域网二维码用；dsh-pocket 停着时也能显示）。 */
export function lanAddress(override = '') {
  if (override) return override
  try {
    const list = []
    for (const addrs of Object.values(networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family !== 'IPv4' || a.internal) continue
        list.push({ address: a.address })
      }
    }
    // 常见家用/办公网段优先，其次取第一个
    const preferred = list.find((x) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address))
    return (preferred ?? list[0])?.address ?? ''
  } catch {
    return ''
  }
}

function tcpProbe(port, timeoutMs = 400) {
  return new Promise((resolve) => {
    if (!Number.isInteger(port) || port <= 0) return resolve(false)
    const socket = connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/** 把 Set-Cookie 合并进一个小罐子（只保留 name=value）。 */
function absorbJar(jar, res) {
  let list = []
  try {
    list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  } catch {
    list = []
  }
  for (const line of list) {
    const pair = String(line).split(';')[0]
    const at = pair.indexOf('=')
    if (at <= 0) continue
    const name = pair.slice(0, at).trim()
    const value = pair.slice(at + 1).trim()
    if (name) jar[name] = value
  }
  return jar
}

const jarHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

/**
 * 一次会话的 RPC 客户端。
 * @param {{ port?: () => number, connection?: () => any, log?: any }} deps
 */
export function createClient(deps = {}) {
  const port = () => {
    const p = Number(deps.port?.())
    return Number.isInteger(p) && p > 0 ? p : DEFAULT_PORT
  }
  const base = () => `http://127.0.0.1:${port()}`
  let jar = {}
  let bootedAt = 0
  let booting
  let lastError = ''

  async function bootstrapViaConnection() {
    const conn = deps.connection?.()
    if (!conn || typeof conn.authenticatedUrl !== 'function') return false
    let url
    try {
      url = conn.authenticatedUrl(`${base()}/`)
    } catch {
      return false
    }
    const res = await fetch(url, { redirect: 'manual', headers: { 'sec-fetch-site': 'same-origin' } })
    // 303 + Set-Cookie；就算上游换了实现直接 200，只要发了 cookie 也算成功
    const next = absorbJar({ ...jar }, res)
    if (Object.keys(next).some((k) => k.startsWith('dsh-auth-'))) {
      jar = next
      return true
    }
    return false
  }

  async function bootstrapViaProxy() {
    const settings = readSettingsNow()
    const pins = localPins()
    const pin = pins.lan || pins.public
    if (!pin) return false
    const proxyPort = settings.proxyPort
    if (!(await tcpProbe(proxyPort))) return false
    const proxy = `http://127.0.0.1:${proxyPort}`
    let next = {}
    let res = await fetch(`${proxy}/?token=${encodeURIComponent(pin)}`, { redirect: 'manual' })
    absorbJar(next, res)
    if (!Object.keys(next).length) return false
    // 第二次 GET 让代理补 launch token，上游回 dsh-auth-*
    res = await fetch(`${proxy}/`, { redirect: 'manual', headers: { cookie: jarHeader(next) } })
    absorbJar(next, res)
    if (!Object.keys(next).some((k) => k.startsWith('dsh-auth-'))) return false
    jar = next
    return true
  }

  async function bootstrap() {
    booting ??= (async () => {
      lastError = ''
      for (const step of [bootstrapViaConnection, bootstrapViaProxy]) {
        try {
          if (await step()) {
            bootedAt = Date.now()
            return true
          }
        } catch (err) {
          lastError = String(err?.message ?? err)
        }
      }
      return false
    })().finally(() => { booting = undefined })
    return booting
  }

  async function rawCall(endpoint, payload, timeoutMs) {
    const body = JSON.stringify({ rpcId: `pocket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, method: endpoint, payload: payload ?? {} })
    const res = await fetch(`${base()}/dsh-pocket/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: jarHeader(jar) },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res
  }

  /**
   * 调一个 pocket 接口。
   * @returns {Promise<{ok: boolean, value?: any, error?: string, unauthorized?: boolean}>}
   */
  async function call(endpoint, payload = {}, { timeoutMs = 8000, retry = true } = {}) {
    const fresh = Date.now() - bootedAt < BOOTSTRAP_TTL_MS
    if (!fresh && Object.keys(jar).length === 0) {
      if (!(await bootstrap())) return { ok: false, error: lastError || 'no-session' }
    }
    let res
    try {
      res = await rawCall(endpoint, payload, timeoutMs)
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
    if (res.status === 401 || res.status === 403) {
      jar = {}
      bootedAt = 0
      if (retry && (await bootstrap())) {
        return call(endpoint, payload, { timeoutMs, retry: false })
      }
      return { ok: false, error: 'unauthorized', unauthorized: true }
    }
    if (res.status === 404) return { ok: false, error: 'no-route' }
    let json
    try {
      json = await res.json()
    } catch {
      return { ok: false, error: `http-${res.status}` }
    }
    const result = json?.result
    if (!result || result.ok !== true) {
      return { ok: false, error: String(result?.error?.message ?? `http-${res.status}`) }
    }
    return { ok: true, value: result.value }
  }

  /** dsh-pocket 是否装了：能连上 RPC，或本机有它的数据目录。 */
  async function probe() {
    const r = await call(ENDPOINTS.status, {}, { timeoutMs: 5000 })
    if (r.ok) return { installed: true, viaRpc: true, status: r.value }
    const settings = readSettingsNow()
    const looksInstalled = settings.installedFiles || existsSync(pocketDir())
    return { installed: looksInstalled, viaRpc: false, reason: r.error }
  }

  return {
    call,
    probe,
    port,
    reset() { jar = {}; bootedAt = 0 },
    get lastError() { return lastError },
  }
}

/** 没有 RPC 时，用本机文件拼一份够用的只读状态。 */
export async function fallbackStatus(client) {
  const s = readSettingsNow()
  const pins = localPins()
  const ip = lanAddress(s.lanIpOverride)
  const proxyUp = await tcpProbe(s.proxyPort)
  const auto = readJson(join(pocketDir(), 'tunnel-auto.json'))
  return {
    proxyRunning: proxyUp,
    proxyPort: s.proxyPort,
    lanUrl: ip && s.lanEnabled ? `http://${ip}:${s.proxyPort}` : null,
    lanQr: null,
    lanCandidates: ip ? [ip] : [],
    lanIpOverride: s.lanIpOverride,
    lanEnabled: s.lanEnabled,
    lanAuthEnabled: s.lanAuthEnabled,
    mobileRightbarEnabled: s.mobileRightbarEnabled,
    lanToken: pins.lan || null,
    accessToken: pins.public || null,
    lanPinCustom: s.lanPinCustom,
    publicPinCustom: s.publicPinCustom,
    tunnelRunning: false,
    tunnelUrl: null,
    tunnelQr: null,
    tunnelState: { phase: auto?.at ? 'unknown' : 'idle', detail: '' },
    tunnelHealth: null,
    tunnelConfig: { mode: s.tunnelMode, hostname: s.tunnelHostname, tokenSet: s.tunnelTokenSet },
    dshPort: client.port(),
    desktop: false,
    restartNotice: null,
    readOnly: true,
  }
}
