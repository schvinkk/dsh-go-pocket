// dsh-go-pocket：在 dsh-go 手机原生界面里用 dsh-pocket（手机访问）。
//
// 为什么需要它：dsh-pocket 是 Harness 网页插件——想开公网、看二维码、换密码，
// 过去要切到网页版设置页。这个插件把同一份能力搬进手机 App：输入框上方的状态条、
// 一个面板里的局域网/公网二维码与开关，全部走 dsh-pocket 自己的控制接口，
// 不另存一份配置、不伪造状态。
//
// 数据通路（见 lib/pocket.js）：
//   本机引擎会话 cookie → POST /dsh-pocket/<endpoint>（和网页版设置页同一条通道）
//   拿不到会话时退化成读 $DSH_HOME/dsh-pocket 下的文件（只读，改动类操作会说明不可用）。
//
// 只在有 dsh-go 桥接的主机上注册原生界面；其他主机上安静地什么都不做。
import { createClient, fallbackStatus, ENDPOINTS, readSettingsNow } from './pocket.js'
import { mainView, pinView, moreView, stripText, TRANSPARENT_PNG } from './view.js'
import { words } from './words.js'

export const name = 'dsh-go-pocket'

const STATUS_TTL_MS = 3000
const STRIP_POLL_MS = 30_000
const PANEL_POLL_MS = 15_000
const PIN_RE = /^[a-zA-Z0-9]{8,64}$/
/** 桥接的普通 handler 只有 3 秒；慢活一律走 pending。 */
const SLOW_LABEL_MS = 60_000

export function apply(ctx, config = {}) {
  const log = (typeof ctx.logger === 'function' ? ctx.logger('dsh-go-pocket') : undefined) ?? console
  const client = createClient({
    port: () => {
      // 插件和引擎同进程：优先用 webServer 自己的端口，拿不到再退回配置/3080
      try {
        const p = ctx.get?.('webServer')?.port
        if (Number.isInteger(p) && p > 0) return p
      } catch { /* 没有 webServer 服务 */ }
      return config.port ?? 3080
    },
    connection: () => {
      try {
        return ctx.get?.('connection')
      } catch {
        return undefined
      }
    },
  })

  /** 最近一次状态；短 TTL，避免一次点按里连打好几次 status。 */
  let cached
  let cachedAt = 0
  let readOnly = false
  let inflight

  async function status({ force = false } = {}) {
    if (!force && cached && Date.now() - cachedAt < STATUS_TTL_MS) return cached
    inflight ??= (async () => {
      const rpc = await client.call(ENDPOINTS.status, {}, { timeoutMs: 6000 })
      if (rpc.ok) {
        readOnly = false
        return rpc.value
      }
      // 没装 / 没连上：只有本机确实有 dsh-pocket 痕迹时才给只读快照
      if (!readSettingsNow().installedFiles) return null
      readOnly = true
      return fallbackStatus(client)
    })().finally(() => { inflight = undefined })
    const value = await inflight
    cached = value
    cachedAt = Date.now()
    return value
  }

  const dirty = () => { cachedAt = 0 }

  const dash = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))
  const yesno = (v, w) => (v ? w.yes : w.no)

  /** 面板数据模型（视图里全部用绑定读取它）。 */
  function model(st, w) {
    const s = st
    return {
      proxyText: s ? (s.proxyRunning ? w.ok : w.off) : w.unknown,
      proxyTone: s ? (s.proxyRunning ? 'good' : 'bad') : 'muted',
      lanText: s ? (s.lanEnabled ? w.lanOn : w.lanOff) : w.unknown,
      lanTone: s ? (s.lanEnabled ? 'good' : 'warn') : 'muted',
      publicText: s ? (s.tunnelRunning ? w.ok : w.off) : w.unknown,
      publicTone: s ? (s.tunnelRunning ? 'good' : 'muted') : 'muted',

      notice: s
        ? (s.restartNotice ? w.restartNotice : (s.lanEnabled ? '' : w.tipLanOff))
        : w.tipNoPocket,

      lanQr: s?.lanQr || TRANSPARENT_PNG,
      lanUrl: dash(s?.lanUrl),
      lanPin: s ? (s.lanAuthEnabled ? dash(s.lanToken) : w.lanPinOff) : '—',
      lanPinFixedText: s ? yesno(s.lanPinCustom, w) : '—',

      publicQr: s?.tunnelQr || TRANSPARENT_PNG,
      publicUrl: dash(s?.tunnelUrl),
      publicPin: dash(s?.accessToken),
      publicPinFixedText: s ? yesno(s.publicPinCustom, w) : '—',
      modeText: s ? (s.tunnelConfig?.mode === 'named' ? w.modeNamed : w.modeQuick) : '—',

      healText: s?.tunnelHealth
        ? (s.tunnelHealth.consecutiveFailures > 0 ? `${w.reconnecting} ${s.tunnelHealth.consecutiveFailures}` : w.ok)
        : w.unknown,
      rightbarText: s ? (s.mobileRightbarEnabled ? w.lanOn : w.lanOff) : '—',
      dshPortText: dash(s?.dshPort),
      proxyPortText: s ? (s.proxyRunning ? `:${s.proxyPort}` : w.off) : '—',

      readOnly: readOnly === true,
      pinHint: s ? (s.lanPinCustom ? w.pinFixedLan : w.pinRotating) : w.tipNoSession,
    }
  }

  const viewModel = (w) => (cached ? model(cached, w) : model(null, w))

  /** 慢活：先回 pending，App 显示「进行中」，结果到了用 patch 更新面板。 */
  const deferred = (label, work) => ({
    pending: { label: String(label).slice(0, 16), timeoutMs: SLOW_LABEL_MS },
    result: work,
  })

  ctx.inject(['dshGo'], (ctx) => {
    // ---------------- 状态条 ----------------
    ctx.dshGo.strip('pocket', (scope, emit, caps) => {
      const w = words(caps?.locale)
      let stopped = false
      const push = async () => {
        let st
        try {
          st = await status()
        } catch {
          st = null
        }
        if (!stopped) emit(stripText(st, w))
      }
      void push()
      const timer = setInterval(() => void push(), STRIP_POLL_MS)
      if (typeof timer.unref === 'function') timer.unref()
      return () => {
        stopped = true
        clearInterval(timer)
      }
    })

    /** 三块面板共用的数据源：先推一次，之后定时刷新。 */
    const makeData = (locale) => (scope, emit) => {
      const w = words(locale)
      let stopped = false
      const push = async (force = false) => {
        let st
        try {
          st = await status({ force })
        } catch {
          st = null
        }
        if (!stopped) emit(model(st, w))
      }
      void push()
      const timer = setInterval(() => void push(true), PANEL_POLL_MS)
      if (typeof timer.unref === 'function') timer.unref()
      return () => {
        stopped = true
        clearInterval(timer)
      }
    }

    ctx.dshGo.panel('main', {
      view: (scope, caps) => mainView(words(caps?.locale)),
      data: (scope, emit, caps) => makeData(caps?.locale)(scope, emit),
      actions: {
        'goto-more': () => ({ open: 'panel:more' }),
        'goto-main': () => ({ open: 'panel:main' }),
        'refresh': (scope, event) =>
          deferred(words(event?.locale).actionRefresh, async () => {
            const st = await status({ force: true })
            return { patch: model(st, words(event?.locale)) }
          }),
        'copy-lan': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.lanUrl ? { copy: st.lanUrl, toast: w.toastCopied } : { toast: w.toastNothing }
        },
        'copy-public': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.tunnelUrl ? { copy: st.tunnelUrl, toast: w.toastCopied } : { toast: w.toastNothing }
        },
        'copy-lan-pin': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.lanToken ? { copy: st.lanToken, toast: w.toastCopied } : { toast: w.toastNothing }
        },
        'copy-public-pin': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.accessToken ? { copy: st.accessToken, toast: w.toastCopied } : { toast: w.toastNothing }
        },
        'tunnel-start': (scope, event) => {
          const w = words(event?.locale)
          if (event?.value?.confirmed !== true) return { toast: w.cancelWord }
          if (readOnly) return { toast: w.toastNoSession }
          return deferred(w.actionStart, async () => {
            const r = await client.call(ENDPOINTS.tunnelStart, { disclaimer: true }, { timeoutMs: 55_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? w.toastPublicOn : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
        'tunnel-stop': (scope, event) => {
          const w = words(event?.locale)
          if (event?.value?.confirmed !== true) return { toast: w.cancelWord }
          return deferred(w.actionStop, async () => {
            const r = await client.call(ENDPOINTS.tunnelStop, {}, { timeoutMs: 20_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? w.toastPublicOff : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
      },
    })

    ctx.dshGo.panel('pin', {
      view: (scope, caps) => pinView(words(caps?.locale)),
      data: (scope, emit, caps) => makeData(caps?.locale)(scope, emit),
      actions: {
        'goto-main': () => ({ open: 'panel:main' }),
        'refresh': (scope, event) =>
          deferred(words(event?.locale).actionRefresh, async () => {
            const st = await status({ force: true })
            return { patch: model(st, words(event?.locale)) }
          }),
        'lan-pin-new': (scope, event) =>
          deferred(words(event?.locale).actionNewLanPin, async () => {
            const w = words(event?.locale)
            const r = await client.call(ENDPOINTS.lanTokenRefresh, {}, { timeoutMs: 10_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? w.toastPinNew : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          }),
        'copy-lan-pin': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.lanToken ? { copy: st.lanToken, toast: w.toastCopied } : { toast: w.toastNothing }
        },
        'copy-public-pin': async (scope, event) => {
          const w = words(event?.locale)
          const st = await status()
          return st?.accessToken ? { copy: st.accessToken, toast: w.toastCopied } : { toast: w.toastNothing }
        },
      },
    })

    ctx.dshGo.panel('more', {
      view: (scope, caps) => moreView(words(caps?.locale)),
      data: (scope, emit, caps) => makeData(caps?.locale)(scope, emit),
      actions: {
        'goto-main': () => ({ open: 'panel:main' }),
        'refresh': (scope, event) =>
          deferred(words(event?.locale).actionRefresh, async () => {
            const st = await status({ force: true })
            return { patch: model(st, words(event?.locale)) }
          }),
        'lan-toggle': (scope, event) => {
          const w = words(event?.locale)
          const on = !(cached?.lanEnabled ?? true)
          return deferred(on ? w.toastLanOn : w.toastLanOff, async () => {
            const r = await client.call(ENDPOINTS.lanSetEnabled, { on }, { timeoutMs: 10_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? (on ? w.toastLanOn : w.toastLanOff) : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
        'lan-pin-toggle': (scope, event) => {
          const w = words(event?.locale)
          const on = !(cached?.lanAuthEnabled ?? true)
          return deferred(on ? w.toastPinOn : w.toastPinOff, async () => {
            const r = await client.call(ENDPOINTS.lanAuthSetEnabled, { on }, { timeoutMs: 10_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? (on ? w.toastPinOn : w.toastPinOff) : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
        'rightbar-toggle': (scope, event) => {
          const w = words(event?.locale)
          const on = !(cached?.mobileRightbarEnabled ?? true)
          return deferred(on ? w.toastRightbarOn : w.toastRightbarOff, async () => {
            const r = await client.call(ENDPOINTS.rightbarSetEnabled, { on }, { timeoutMs: 10_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? (on ? w.toastRightbarOn : w.toastRightbarOff) : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
        'restart': (scope, event) => {
          const w = words(event?.locale)
          if (event?.value?.confirmed !== true) return { toast: w.cancelWord }
          if (readOnly) return { toast: w.toastNoSession }
          return deferred(w.actionRestart, async () => {
            const r = await client.call(ENDPOINTS.restart, {}, { timeoutMs: 12_000 })
            dirty()
            return { toast: r.ok ? w.toastRestart : `${w.err}：${String(r.error).slice(0, 24)}` }
          })
        },
        'reset': (scope, event) => {
          const w = words(event?.locale)
          if (event?.value?.confirmed !== true) return { toast: w.cancelWord }
          if (readOnly) return { toast: w.toastNoSession }
          return deferred(w.actionReset, async () => {
            const r = await client.call(ENDPOINTS.reset, { confirm: true }, { timeoutMs: 20_000 })
            dirty()
            const st = await status({ force: true })
            return {
              patch: model(st, w),
              toast: r.ok ? w.toastReset : `${w.err}：${String(r.error).slice(0, 24)}`,
            }
          })
        },
      },
    })

    // ---------------- 输入框胶囊：把输入框里的字设成固定密码 ----------------
    // 手机上设固定密码最顺手的路径：先在输入框敲好，再点胶囊。
    ctx.dshGo.on('set-lan-pin', (scope, event) => {
      const w = words(event?.locale)
      const text = String(scope?.draft ?? '').trim()
      if (!PIN_RE.test(text)) return { toast: w.toastNeedDraft }
      return deferred(w.toastPinSet, async () => {
        const r = await client.call(ENDPOINTS.pinSetCustom, { which: 'lan', value: text }, { timeoutMs: 10_000 })
        dirty()
        return r.ok ? { toast: `${w.toastPinSet}：${text}` } : { toast: `${w.err}：${String(r.error).slice(0, 24)}` }
      })
    })

    ctx.dshGo.on('set-public-pin', (scope, event) => {
      const w = words(event?.locale)
      const text = String(scope?.draft ?? '').trim()
      if (!PIN_RE.test(text)) return { toast: w.toastNeedDraft }
      return deferred(w.toastPinSet, async () => {
        const r = await client.call(ENDPOINTS.pinSetCustom, { which: 'public', value: text }, { timeoutMs: 10_000 })
        dirty()
        return r.ok ? { toast: `${w.toastPinSet}：${text}` } : { toast: `${w.err}：${String(r.error).slice(0, 24)}` }
      })
    })

    log.info?.('dsh-go-pocket: native panels registered | 手机访问面板已注册')
  })
}

export { words, mainView, pinView, moreView, stripText, readSettingsNow }