# dsh-go-pocket

[![check](https://github.com/schvinkk/dsh-go-pocket/actions/workflows/check.yml/badge.svg)](https://github.com/schvinkk/dsh-go-pocket/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh-go](https://img.shields.io/badge/dsh--go-%E2%89%A51.2.0-6E56CF.svg)](https://github.com/ccch1mneyyy/dsh-go-market)
[![upstream](https://img.shields.io/badge/upstream-dsh--pocket-informational.svg)](https://github.com/shaobeichen/dsh-pocket)

把 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket)（手机访问）搬进 **dsh-go 手机 App 的原生界面**。

以前想看局域网二维码、开公网、换访问密码，得切到网页版「设置 → 手机访问」。装上这个插件后，这些都在手机上：输入框上方一条状态条，点开就是二维码、地址、密码和开关。

> [!IMPORTANT]
> **还没进插件市场，需要手动装。** 市场只接受 npm 上架的包，而这个包暂时没发到 npm，所以 App 的插件市场里搜不到它。手动安装只有两步，见下面「装」一节。装完记得重启引擎，否则界面上不会出现。

## 三十秒装完

```sh
git clone https://github.com/schvinkk/dsh-go-pocket.git
cd dsh-go-pocket && node bin/install.mjs
```

然后在 App 的「引擎」页点一次重启。完成。

> 这是 dsh-go 的**原生插件**（装在 `$DSH_HOME/dsh-go/plugins/`），不是 Harness 网页插件（Cordis bundle）。它复用 dsh-pocket 自己的控制接口，不另存第二份配置。

## 它和上游是什么关系

**上游：[dsh-pocket](https://github.com/shaobeichen/dsh-pocket)** — 作者 shaobeichen，许可 **GPL-2.0**，3000+ stars。局域网/公网二维码、访问密码、cloudflared 隧道、就绪度自愈、代理层，这些能力**全部属于上游**，本项目一个都没重新实现。

本项目做的事只有一件：**给上游配一块手机上的遥控面板。**

| | 上游 dsh-pocket | 本项目 dsh-go-pocket |
| --- | --- | --- |
| 干什么 | 真正实现手机访问 | 在原生界面里显示和操作它 |
| 装在哪 | 网页插件的 profile | `$DSH_HOME/dsh-go/plugins/` |
| 必须装吗 | **必须**，不装本项目没有意义 | 可选，装了更好用 |
| 代码关系 | — | 零复制、零 import、零依赖 |
| 通信方式 | — | HTTP `POST /dsh-pocket/<endpoint>` |
| 许可 | GPL-2.0 | MIT |

**三个关键点：**

1. **dsh-pocket 必须单独安装并启用**（网页版设置里的「手机访问」）。本项目是遥控器，不是替代品；删掉本项目，上游功能一点不受影响。
2. **本项目不含上游任何源代码。** 代码重合度实测 1.31%，且 `lib/view.js`、`lib/words.js` 零重合——重合的部分全是 `JSON.parse`、`content-type` 这类通用写法，以及为了读懂同一份 `settings.json` 必须共用的字段名。
3. **为什么能用 MIT：** 只通过 HTTP 调用独立程序不构成 GPL 意义上的衍生作品。但如果将来有人把上游代码复制进来，**整包必须转为 GPL-2.0**。这条红线写进了 [NOTICE.md](NOTICE.md)。

> 署名上游是出于尊重与诚实，不是因为被 GPL 逼的。二维码、隧道、自愈这一整套有价值的东西是 shaobeichen 做的，本项目只是给它加了块面板。

完整的授权依据、重合度实测数据、下游使用指引，见 **[NOTICE.md](NOTICE.md)**。

## 装之前

| 需要 | 说明 |
| --- | --- |
| dsh-go App | ≥ 1.2.0（原生插件走桥接协议 v1） |
| dsh-pocket | 已安装并启用，同一台机器上 |
| 引擎 | 在 `127.0.0.1` 上跑着 |

## 装

```sh
git clone https://github.com/schvinkk/dsh-go-pocket.git
cd dsh-go-pocket
node bin/install.mjs
```

安装器做三件事：注册 profile 依赖、把插件写进 `dsh.profile.bundles`、在 profile 的 `cordis.patch.yml` 里补一条 plain insert。

**装完必须在 App 的「引擎」页重启一次引擎。** 原生插件在引擎启动时一次性读清单，不重启就一直看不见——这不是插件坏了。

手工装的等价步骤：

```sh
P="$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
dsh plugin --profile web add "$P"
# 再往 $DSH_HOME/profiles/web/cordis.patch.yml 末尾加：
# - insert:
#     - id: dsh-go-pocket
#       name: dsh-go-pocket
```

装好后打开 dsh-go：

- 输入框上方多一条「手机访问 · 局域网+公网」状态条，点它进主面板
- 对话详情页「插件」页签 / 「全部功能」里有三块面板
- 输入框胶囊：「设局域网密码」「设公网密码」

## 有什么

**状态条**——一句话说清现在能不能从手机连进来（局域网 / 公网 / 都没开）。

**主面板**

- 三块指标：本机代理、局域网访问、公网
- 局域网二维码 + 地址 + 密码，一键复制链接 / 复制密码
- 公网二维码 + 地址 + 密码 + 隧道模式，一键复制
- 开 / 关公网，带确认（和网页版一样要先过免责那道门）
- 跳「隧道与更多」

**访问密码面板**——两把密码、是否用了固定密码、换新局域网密码、复制密码。

**隧道与更多**——隧道模式、自愈状态、手机右边栏开关、引擎端口、重启引擎、恢复出厂（都要确认）。

**输入框胶囊**——把输入框里的字设成固定密码（8–64 位字母或数字）。手机上改密码最顺手的路径：先敲，再点一下。

## 它是怎么连上的

dsh-pocket 把控制接口挂在引擎自己的 Web 服务器上：`POST /dsh-pocket/<endpoint>`，loopback + 引擎会话 cookie 双重门禁。本插件和引擎同进程，所以按三层降级：

1. 用 `connection.authenticatedUrl()` 拿带 launch token 的入口地址，本机 `GET` 一次换回 `dsh-auth-*` cookie
2. 换不到就走 dsh-pocket 的代理端口，用局域网密码换 cookie
3. 都拿不到就退化成**只读**：直接读 `$DSH_HOME/dsh-pocket/` 下的状态文件，面板照常显示二维码、地址、密码，但改动类按钮会明说「只能看不能改」

不复制密码文件、不伪造接口、不缓存配置。状态和网页版永远一致，因为它读的就是同一份。

## 网页端插件突然全打不开（401）

**症状**：装/卸过插件、更新过 DSH、或 App 冷启动之后，网页端设置页一片「加载失败」，所有插件的接口都回 401，但重启前一切正常。

**原因**（上游 dsh-pocket 的鉴权缺陷）：它的登录 cookie 值是 `sha256(PIN:sessionKey)`，而 `sessionKey` 是**每次 `dsh web` 启动都重新随机生成**的进程级密钥。所以引擎每重启一次，浏览器里的旧 cookie 全部失配 —— 而 `isProtectedHost()` 又把 loopback（`127.0.0.1`）也算成「需要密码」，于是你**自己这台机器**访问自己的引擎也被拦成 401。

**修法**：让 loopback 永远免密（它不跨越任何信任边界——能连 `127.0.0.1` 的进程本来就已经在设备上）。局域网仍按设置页的开关走，公网仍强制密码，安全语义不变。

```sh
# 在插件目录里执行，会自动找到 $DSH_HOME/profiles/*/node_modules/dsh-pocket
node bin/patch-loopback-noauth.mjs

# 只看状态 / 还原
node bin/patch-loopback-noauth.mjs --check
node bin/patch-loopback-noauth.mjs --revert
```

改完**重启 dsh web** 生效。上游若更新覆盖了 `proxy.mjs`，重跑一次即可（脚本幂等，认不出上游代码时会明确报错而不是乱改）。


## 卸载

```sh
dsh plugin --profile web remove dsh-go-pocket
rm -rf "$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
```

再从 `cordis.patch.yml` 里删掉那条 insert（安装器的备份在 `cordis.patch.yml.bak-dsh-go-pocket-*`）。

## 开发

```sh
npm test                                                    # 12 个单元测试
node "$DSH_HOME/skills/dsh-go-plugin/kit/bin/check.mjs" . --load --lang zh --app 1.2.0
```

`check.mjs` 是 dsh-go App 自带的 dsh-go-plugin 技能里的检查器，退出码 0 才算过。改了 `lib/` 里的代码要重启引擎才生效。

细节见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

这个插件会把局域网地址、公网地址和访问密码显示在手机界面上。开公网等于把能执行代码的引擎暴露到互联网——用强密码，用完就关。**提 issue 前先给截图里的地址、密码和二维码打码。**

见 [SECURITY.md](SECURITY.md)。

## 许可

| 对象 | 许可 | 说明 |
| --- | --- | --- |
| 本项目 dsh-go-pocket | **MIT** | 见 [LICENSE](LICENSE)。可商用、可修改、可再分发，保留声明即可 |
| 上游 dsh-pocket | **GPL-2.0** | 本项目不包含其代码，故不需要转 GPL，也不附带 GPL 全文 |

**唯一红线**：如果把上游代码复制进本仓库，整包必须转为 GPL-2.0。依据与实测数据见 [NOTICE.md](NOTICE.md)。

---

English: [README.en.md](README.en.md)