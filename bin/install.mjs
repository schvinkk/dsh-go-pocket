#!/usr/bin/env node
// dsh-go-pocket 安装器。
//
//   npx dsh-go-pocket            # 从当前目录/已安装的包安装到 web profile
//   dsh-go-pocket --dir <路径>   # 指定插件目录
//   dsh-go-pocket --profile web  # 指定 profile（默认 web，手机本机引擎用的就是它）
//   dsh-go-pocket --check        # 只跑检查器，不安装
//
// 它会做两件事：把插件目录注册进 profile 依赖（dsh plugin add），并在
// profile 的 cordis.patch.yml 里补一条 plain insert，让引擎热挂载。
// 已经装过时只刷新 insert，不重复写。

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(here, '..')
const home = process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh')

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.includes(name)

const profile = arg('--profile', 'web')
const dir = resolve(arg('--dir', pkgDir))
const profileDir = join(home, 'profiles', profile)
const patchFile = join(profileDir, 'cordis.patch.yml')
const pkgJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
const name = pkgJson.name

const say = (m) => process.stdout.write(`${m}\n`)

if (!existsSync(join(profileDir, 'package.json'))) {
  say(`× 找不到 profile：${profileDir}`)
  say('  先在这一台机器上跑过 dsh web / dsh-go 引擎，再装插件。')
  process.exit(1)
}

if (has('--check')) {
  const checker = join(home, 'skills', 'dsh-go-plugin', 'kit', 'bin', 'check.mjs')
  if (!existsSync(checker)) {
    say('× 没有自带的插件检查器（$DSH_HOME/skills/dsh-go-plugin）')
    process.exit(1)
  }
  execFileSync(process.execPath, [checker, dir, '--load', '--lang', 'zh'], { stdio: 'inherit' })
  process.exit(0)
}

// 1) 依赖注册：让引擎能按包名解析到这个目录
try {
  execFileSync('dsh', ['plugin', '--profile', profile, 'add', dir], { stdio: 'inherit' })
  say(`✓ 已加入 profile 依赖：${name}`)
} catch {
  say('! dsh plugin add 没有走完（pnpm 构建检查或网络问题），改用本地链接兜底。')
  const link = join(profileDir, 'node_modules', name)
  try {
    execFileSync('ln', ['-sfn', dir, link])
    say(`✓ 已建立链接：${link}`)
  } catch (err) {
    say(`× 链接失败：${err?.message ?? err}`)
    process.exit(1)
  }
}

// 2) bundle 选择（引擎重启后仍生效）
try {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dsh ??= {}
  manifest.dsh.profile ??= {}
  manifest.dsh.profile.bundles ??= []
  if (!manifest.dsh.profile.bundles.includes(name)) {
    manifest.dsh.profile.bundles.push(name)
    writeFileSync(manifestPath, `${JSON.stringify(manifest, void 0, 2)}\n`)
    say(`✓ 已登记 bundle：${name}`)
  }
} catch (err) {
  say(`! 写 bundle 清单失败：${err?.message ?? err}`)
}

// 3) plain insert：热挂载（不需要重启引擎）
if (!existsSync(patchFile)) {
  say(`× 找不到 ${patchFile}`)
  process.exit(1)
}
const patch = readFileSync(patchFile, 'utf8')
if (!new RegExp(`^\\s+name:\\s*['"]?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*$`, 'm').test(patch)) {
  copyFileSync(patchFile, `${patchFile}.bak-dsh-go-pocket-${Date.now()}`)
  writeFileSync(patchFile, `${patch.replace(/\s*$/, '')}\n\n- insert:\n    - id: ${name}\n      name: ${name}\n`)
  say(`✓ 已加入 cordis.patch.yml（热挂载）`)
} else {
  say('✓ cordis.patch.yml 里已有该插件')
}

say('')
say('装好了。打开 dsh-go：')
say('  · 输入框上方会多一条「手机访问」状态条，点它看二维码与开关')
say('  · 对话详情页「插件」页签 / 「全部功能」里有「手机访问」「访问密码」「隧道与更多」三块面板')
say('  · 想设固定密码：把密码打进输入框，点「设局域网密码」或「设公网密码」')
say('')
say('改了 lib/ 里的代码后，需要在 App 的「引擎」页重启引擎才生效。')
