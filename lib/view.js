// 面板视图。视图是纯的：只吃数据模型，不发网络请求、不读文件。
// 动态值全部走绑定（{ $: 'data.xxx' }），数据由 lib/index.js 的 data() 推送，
// 这样二维码、地址、密码、开关文案都会随推送自动更新，不需要用户点刷新。

const b = (path) => ({ $: `data.${path}` })

/** 主面板：状态一栏 + 局域网 + 公网 + 入口按钮。 */
export function mainView(w) {
  return {
    v: 2,
    type: 'stack',
    title: w.panelMain,
    children: [
      {
        type: 'row',
        children: [
          { type: 'metric', label: w.proxy, value: b('proxyText'), tone: b('proxyTone') },
          { type: 'metric', label: w.lanAccess, value: b('lanText'), tone: b('lanTone') },
          { type: 'metric', label: w.public, value: b('publicText'), tone: b('publicTone') },
        ],
      },
      { type: 'callout', text: b('notice'), tone: 'info' },
      { type: 'divider', size: 'M' },
      { type: 'text', text: w.lan, style: { size: 'title', weight: 'bold' } },
      { type: 'image', src: b('lanQr'), caption: w.qrLanCap, aspect: 1 },
      {
        type: 'keyValue',
        items: [
          { label: w.lanAddr, value: b('lanUrl') },
          { label: w.lanPin, value: b('lanPin') },
        ],
      },
      {
        type: 'actions',
        items: [
          { label: w.actionCopyLan, action: 'copy-lan', icon: 'link', style: 'plain' },
          { label: w.actionCopyLanPin, action: 'copy-lan-pin', icon: 'copy', style: 'plain' },
        ],
      },
      { type: 'divider', size: 'M' },
      { type: 'text', text: w.public, style: { size: 'title', weight: 'bold' } },
      { type: 'image', src: b('publicQr'), caption: w.qrPublicCap, aspect: 1 },
      {
        type: 'keyValue',
        items: [
          { label: w.publicAddr, value: b('publicUrl') },
          { label: w.publicPin, value: b('publicPin') },
          { label: w.tunnelMode, value: b('modeText') },
        ],
      },
      {
        type: 'actions',
        items: [
          { label: w.actionCopyPublic, action: 'copy-public', icon: 'link', style: 'plain' },
          { label: w.actionCopyPublicPin, action: 'copy-public-pin', icon: 'copy', style: 'plain' },
        ],
      },
      { type: 'callout', text: w.disclaimer, tone: 'info' },
      { type: 'confirm', id: 'tunnel-start', confirmLabel: w.actionStart, cancelLabel: w.cancelWord },
      { type: 'confirm', id: 'tunnel-stop', confirmLabel: w.actionStop, cancelLabel: w.cancelWord },
      { type: 'divider', size: 'M' },
      { type: 'callout', text: w.tipPinCustom, tone: 'info' },
      {
        type: 'actions',
        items: [
          { label: w.actionRefresh, action: 'refresh', icon: 'refresh', style: 'plain' },
          { label: w.actionMore, action: 'goto-more', icon: 'more', style: 'plain' },
        ],
      },
    ],
  }
}

/** 密码面板：两把密码与「是否固定」，以及换新/复制。 */
export function pinView(w) {
  return {
    v: 2,
    type: 'stack',
    title: w.panelPin,
    children: [
      { type: 'callout', text: b('pinHint'), tone: 'info' },
      {
        type: 'keyValue',
        items: [
          { label: w.lanPin, value: b('lanPin') },
          { label: w.lanPinFixed, value: b('lanPinFixedText') },
          { label: w.publicPin, value: b('publicPin') },
          { label: w.publicPinFixed, value: b('publicPinFixedText') },
        ],
      },
      {
        type: 'actions',
        items: [
          { label: w.actionNewLanPin, action: 'lan-pin-new', icon: 'refresh', style: 'plain' },
          { label: w.actionCopyLanPin, action: 'copy-lan-pin', icon: 'copy', style: 'plain' },
          { label: w.actionCopyPublicPin, action: 'copy-public-pin', icon: 'copy', style: 'plain' },
        ],
      },
      { type: 'divider', size: 'M' },
      { type: 'callout', text: w.tipPinCustom, tone: 'info' },
      { type: 'actions', items: [{ label: w.actionBack, action: 'goto-main', icon: 'more', style: 'plain' }] },
    ],
  }
}

/** 隧道与更多：自愈、右边栏、重启、恢复出厂。 */
export function moreView(w) {
  return {
    v: 2,
    type: 'stack',
    title: w.panelMore,
    children: [
      {
        type: 'keyValue',
        items: [
          { label: w.tunnelMode, value: b('modeText') },
          { label: w.publicAddr, value: b('publicUrl') },
          { label: w.heal, value: b('healText') },
          { label: w.rightbar, value: b('rightbarText') },
          { label: w.dshPort, value: b('dshPortText') },
          { label: w.proxy, value: b('proxyPortText') },
        ],
      },
      {
        type: 'actions',
        items: [
          { label: w.actionLanToggle, action: 'lan-toggle', icon: 'globe', style: 'plain' },
          { label: w.actionLanPinToggle, action: 'lan-pin-toggle', icon: 'pin', style: 'plain' },
          { label: w.actionRightbarToggle, action: 'rightbar-toggle', icon: 'sidebar', style: 'plain' },
        ],
      },
      { type: 'divider', size: 'M' },
      { type: 'callout', text: w.tipRestart, tone: 'info' },
      { type: 'confirm', id: 'restart', confirmLabel: w.actionRestart, cancelLabel: w.cancelWord },
      { type: 'callout', text: w.tipReset, tone: 'info' },
      { type: 'confirm', id: 'reset', confirmLabel: w.actionReset, cancelLabel: w.cancelWord },
      { type: 'divider', size: 'M' },
      {
        type: 'actions',
        items: [
          { label: w.actionRefresh, action: 'refresh', icon: 'refresh', style: 'plain' },
          { label: w.actionBack, action: 'goto-main', icon: 'more', style: 'plain' },
        ],
      },
    ],
  }
}

/** 状态条文案（≤ 24 字）。 */
export function stripText(st, w) {
  if (!st) return { text: w.stripNoPocket, icon: 'phone', tone: 'muted' }
  if (!st.proxyRunning) return { text: w.stripOff, icon: 'phone', tone: 'bad' }
  const flags = []
  if (st.lanEnabled) flags.push(w.lan)
  if (st.tunnelRunning) flags.push(w.public)
  const text = flags.length ? `${w.pluginTitle} · ${flags.join('+')}` : `${w.pluginTitle} · ${w.off}`
  return { text: text.slice(0, 24), icon: 'phone', tone: st.tunnelRunning ? 'good' : 'info' }
}

/** 1×1 透明 PNG：没有二维码时占位，避免图片组件拿到空串。 */
export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='
