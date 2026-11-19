// 纯函数与视图结构的测试：node --test test/*.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { words } from '../lib/words.js'
import { mainView, pinView, moreView, stripText, TRANSPARENT_PNG } from '../lib/view.js'
import { lanAddress, readSettingsNow, localPins, ENDPOINTS, createClient } from '../lib/pocket.js'

const ZH = words('zh-CN')
const EN = words('en-US')

test('中英文文案键完全一致', () => {
  const zh = Object.keys(words('zh'))
  const en = Object.keys(words('en'))
  assert.deepEqual(zh.sort(), en.sort())
})

test('英文文案里没有中文', () => {
  for (const [key, value] of Object.entries(words('en'))) {
    assert.ok(!/[\u4e00-\u9fff]/.test(value), `${key} 含中文：${value}`)
  }
})

test('三块面板都能生成为 v2 视图，且带标题', () => {
  for (const [name, view] of [['main', mainView(ZH)], ['pin', pinView(ZH)], ['more', moreView(ZH)]]) {
    assert.equal(view.v, 2, name)
    assert.equal(view.type, 'stack', name)
    assert.ok(typeof view.title === 'string' && view.title.length > 0, name)
    assert.ok(Array.isArray(view.children) && view.children.length > 0, name)
  }
})

test('主面板把二维码、地址、密码都绑到数据模型上', () => {
  const flat = JSON.stringify(mainView(ZH))
  for (const path of ['data.lanQr', 'data.publicQr', 'data.lanUrl', 'data.publicUrl', 'data.lanPin', 'data.publicPin']) {
    assert.ok(flat.includes(`"$":"${path}"`), `缺少绑定 ${path}`)
  }
})

test('面板里的动作都是本插件声明的（没有伪造 action id）', () => {
  const declared = new Set([
    'goto-main', 'goto-more', 'refresh',
    'copy-lan', 'copy-public', 'copy-lan-pin', 'copy-public-pin',
    'lan-pin-new', 'lan-toggle', 'lan-pin-toggle', 'rightbar-toggle',
  ])
  const collect = (node, out = []) => {
    if (Array.isArray(node)) { for (const n of node) collect(n, out); return out }
    if (node && typeof node === 'object') {
      if (node.type === 'actions') for (const item of node.items ?? []) {
        const a = item.action
        if (typeof a === 'string') out.push(a)
        else if (a && typeof a === 'object' && typeof a.id === 'string') out.push(a.id)
      }
      for (const v of Object.values(node)) collect(v, out)
    }
    return out
  }
  for (const view of [mainView(ZH), pinView(ZH), moreView(ZH)]) {
    for (const action of collect(view)) assert.ok(declared.has(action), `未声明的动作 ${action}`)
  }
})

test('确认类组件只用在本插件处理了的动作上', () => {
  const ids = []
  const collect = (node) => {
    if (Array.isArray(node)) { node.forEach(collect); return }
    if (node && typeof node === 'object') {
      if (node.type === 'confirm') ids.push(node.id)
      Object.values(node).forEach(collect)
    }
  }
  collect(mainView(ZH)); collect(moreView(ZH))
  assert.deepEqual(ids.sort(), ['reset', 'restart', 'tunnel-start', 'tunnel-stop'])
})

test('状态条文案不超过 24 字', () => {
  const cases = [
    undefined,
    { proxyRunning: false },
    { proxyRunning: true, lanEnabled: true, tunnelRunning: false },
    { proxyRunning: true, lanEnabled: true, tunnelRunning: true },
    { proxyRunning: true, lanEnabled: false, tunnelRunning: false },
  ]
  for (const st of cases) {
    for (const w of [ZH, EN]) {
      const out = stripText(st, w)
      assert.ok(out.text.length <= 24, `${out.text} (${out.text.length})`)
      assert.ok(['good', 'warn', 'bad', 'info', 'muted'].includes(out.tone))
    }
  }
})

test('占位图是合法的 1×1 PNG data URL', () => {
  assert.match(TRANSPARENT_PNG, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
  assert.equal(Buffer.from(TRANSPARENT_PNG.split(',')[1], 'base64').subarray(1, 4).toString(), 'PNG')
})

test('端点名与 dsh-pocket 的 RPC 契约一致', () => {
  assert.equal(ENDPOINTS.status, 'pocket.status')
  assert.equal(ENDPOINTS.tunnelStart, 'tunnel.start')
  assert.equal(ENDPOINTS.tunnelStop, 'tunnel.stop')
  assert.equal(ENDPOINTS.lanSetEnabled, 'lan.setEnabled')
  assert.equal(ENDPOINTS.lanAuthSetEnabled, 'lanAuth.setEnabled')
  assert.equal(ENDPOINTS.pinSetCustom, 'pin.setCustom')
  assert.equal(ENDPOINTS.reset, 'pocket.reset')
})

test('本机设置读取不会抛出，缺失文件时给默认值', () => {
  const s = readSettingsNow()
  assert.equal(typeof s.lanEnabled, 'boolean')
  assert.equal(typeof s.proxyPort, 'number')
  assert.ok(['quick', 'named'].includes(s.tunnelMode))
  const pins = localPins()
  assert.equal(typeof pins.lan, 'string')
  assert.equal(typeof pins.public, 'string')
})

test('局域网地址是合法的 IPv4 或空串', () => {
  const ip = lanAddress()
  assert.ok(ip === '' || /^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
  assert.equal(lanAddress('10.0.0.5'), '10.0.0.5')
})

test('没有会话时不抛错，只返回失败结果', async () => {
  const client = createClient({ port: () => 1 })  // 必然连不上
  const r = await client.call(ENDPOINTS.status, {}, { timeoutMs: 300 })
  assert.equal(r.ok, false)
  assert.equal(typeof r.error, 'string')
})