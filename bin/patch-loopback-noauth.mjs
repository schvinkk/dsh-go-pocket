#!/usr/bin/env node
/**
 * dsh-pocket loopback 免鉴权补丁（本地修复，可重复执行 / 可回滚）
 *
 * 问题：上游 dsh-pocket 的 `isProtectedHost()` 让 loopback（127.0.0.1 / ::1 /
 * localhost）也走 `lanAuthEnabled()` 开关。开着「局域网访问密码」时本机同样被
 * 要求鉴权，而 dsh-pocket 的登录 cookie 是 `sha256(PIN:sessionKey)`，sessionKey
 * 每次 dsh web 启动都重新随机生成 —— 于是引擎一重启（装/卸插件、更新、App 冷
 * 启动）浏览器里的旧 cookie 全部失配，本机所有 /api 与 WebSocket 回 401，网页端
 * 插件集体打不开（设置页一片「加载失败」）。
 *
 * 修复：loopback 永远免密。它不跨越任何信任边界（能连 loopback 的进程本来就
 * 已经在设备上），局域网仍按设置页开关，公网永远强制密码，安全语义不变。
 *
 * 用法：
 *   node bin/patch-loopback-noauth.mjs                # 应用（幂等）
 *   node bin/patch-loopback-noauth.mjs --check        # 只检查状态
 *   node bin/patch-loopback-noauth.mjs --revert       # 还原
 *   node bin/patch-loopback-noauth.mjs --path <目录>  # 指定 dsh-pocket 安装目录
 *
 * 默认在常见位置自动查找 dsh-pocket：
 *   $DSH_HOME/profiles/*\/node_modules/dsh-pocket
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const marker = 'dsh-pocket-loopback-noauth'

const original = `/** 该 Host 是否受访问密码保护（公网一律要密码；局域网/本机按设置页开关）。 */
function isProtectedHost(host, isProtected) {
  return isProtected ? isProtected(host) : classifyHost(host) === 'public';
}`

const patched = `/**
 * 该 Host 是否受访问密码保护（公网一律要密码；局域网/本机按设置页开关）。
 *
 * [${marker}] 本机回环（127.0.0.0/8、::1、localhost、无 Host）**永远免密**：
 * 它不跨越任何网络信任边界——能连到 loopback 的进程本来就已经在设备上，加密码
 * 不增加任何安全性，却会让 dsh web 每次重启后（sessionKey 变化 → cookie 全失效）
 * 把本机浏览器里的所有插件接口打成 401。这条分支必须排在 isProtected 之前，
 * 否则用户的局域网密码开关会连带把本机也锁死。
 */
function isProtectedHost(host, isProtected) {
  if (classifyHost(host) === 'loopback') return false;
  return isProtected ? isProtected(host) : classifyHost(host) === 'public';
}`

function findPocketDirs() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const found = []
  const profiles = join(home, 'profiles')
  if (existsSync(profiles)) {
    for (const name of readdirSync(profiles)) {
      const p = join(profiles, name, 'node_modules', 'dsh-pocket')
      if (existsSync(join(p, 'lib', 'proxy.mjs'))) found.push(p)
    }
  }
  return found
}

const argv = process.argv.slice(2)
const mode = argv.includes('--revert') ? 'revert' : argv.includes('--check') ? 'check' : 'apply'
const explicit = argv.indexOf('--path')
const targets = explicit >= 0 && argv[explicit + 1] ? [resolve(argv[explicit + 1])] : findPocketDirs()

if (targets.length === 0) {
  console.error('找不到 dsh-pocket 安装目录；用 --path 指定（目录里应有 lib/proxy.mjs）')
  process.exit(1)
}

let failed = 0
for (const dir of targets) {
  const file = join(dir, 'lib', 'proxy.mjs')
  if (!existsSync(file)) {
    console.error(`跳过 ${dir}：没有 lib/proxy.mjs`)
    failed++
    continue
  }
  const src = readFileSync(file, 'utf8')
  const isPatched = src.includes(marker)

  if (mode === 'check') {
    console.log(isPatched ? `✅ 已应用  ${file}` : `❌ 未应用  ${file}`)
    if (!isPatched) failed++
    continue
  }

  if (mode === 'revert') {
    if (!isPatched) {
      console.log(`↩️  未应用，无需还原  ${file}`)
      continue
    }
    if (!src.includes(patched)) {
      console.error(`⚠️  补丁块不匹配，请手工还原  ${file}`)
      failed++
      continue
    }
    writeFileSync(file, src.replace(patched, original))
    console.log(`✅ 已还原  ${file}`)
    continue
  }

  // apply
  if (isPatched) {
    console.log(`✅ 已在位  ${file}`)
    continue
  }
  if (!src.includes(original)) {
    console.error(`⚠️  上游代码已变化，找不到原始 isProtectedHost  ${file}`)
    failed++
    continue
  }
  writeFileSync(file, src.replace(original, patched))
  console.log(`✅ 已应用  ${file}`)
}

if (mode === 'apply' && failed === 0) {
  console.log('\n重启 dsh web 后生效：本机浏览器不再被访问密码拦成 401，局域网/公网语义不变。')
}
process.exit(failed > 0 ? 1 : 0)
