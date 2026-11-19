# dsh-go-pocket

把 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket)（手机访问）搬进 **dsh-go 手机 App 的原生界面**。

过去想看局域网二维码、开公网、换访问密码，得切到网页版「设置 → 手机访问」。装上这个插件后，这些都在手机上：输入框上方一条状态条，点开是二维码、地址、密码和开关。

> 这是 dsh-go 的**原生插件**（`$DSH_HOME/dsh-go/plugins/`），不是 Harness 网页插件（Cordis bundle）。它复用 dsh-pocket 自己的控制接口，不另存一份配置。

## 它是基于什么做的（发布必读）

**上游：dsh-pocket** — https://github.com/shaobeichen/dsh-pocket ，作者 shaobeichen，许可 **GPL-2.0**。

局域网/公网二维码、访问密码、cloudflared 隧道、就绪度自愈、代理层这些能力，全部来自上游。本插件是它的**适配层**：在 dsh-go 的原生界面里显示并操作同一份状态。

- 本插件**不包含上游源代码**，只调用它暴露的 `POST /dsh-pocket/<endpoint>` 控制接口；
- **dsh-pocket 必须单独安装并启用**（`dsh plugin --profile web add dsh-pocket`），本插件是遥控器，不是替代品；
- 本插件自身用 MIT；如果把上游代码合并进本仓库，整包必须转为 GPL-2.0。详见 [NOTICE.md](NOTICE.md)。

## 装之前

- dsh-go App（原生插件要 App ≥ 1.2.0，桥接协议 v1）
- 同一台机器上装着并启用了 `dsh-pocket`（网页版设置里的「手机访问」）
- 引擎在 `127.0.0.1` 上跑着

## 装

```sh
# 从 npm（发布后）
npx dsh-go-pocket

# 从源码目录
node bin/install.mjs --dir /path/to/dsh-go-pocket
```

安装器会做三件事：注册 profile 依赖、把插件写进 `dsh.profile.bundles`、在 profile 的 `cordis.patch.yml` 里补一条 plain insert（热挂载，不用重启）。

手工装等价于：

```sh
P="$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
dsh plugin --profile web add "$P"
# 然后在 $DSH_HOME/profiles/web/cordis.patch.yml 末尾加：
# - insert:
#     - id: dsh-go-pocket
#       name: dsh-go-pocket
```

装好后打开 dsh-go：

- 输入框上方多一条「手机访问 · 局域网+公网」状态条，点它进主面板
- 对话详情页「插件」页签 / 「全部功能」里有三块面板
- 输入框胶囊：「设局域网密码」「设公网密码」

## 有什么

**状态条**：一句话说清现在能不能从手机连进来（局域网 / 公网 / 都没开）。

**主面板**

- 三块指标：本机代理、局域网访问、公网
- 局域网二维码 + 地址 + 密码，一键复制链接 / 复制密码
- 公网二维码 + 地址 + 密码 + 隧道模式，一键复制
- 开/关公网（带确认，和网页版一样要先过免责声明那道门）
- 跳「隧道与更多」

**访问密码面板**：两把密码、是否用了固定密码、换新局域网密码、复制密码。

**隧道与更多**：隧道模式、自愈状态、手机右边栏开关、引擎端口、重启引擎、恢复出厂（都要确认）。

**输入框胶囊**：把输入框里的字设成固定密码（8–64 位字母或数字）。手机上改密码最顺手的路径——先敲，再点一下。

## 它是怎么连上的

dsh-pocket 把控制接口挂在引擎自己的 Web 服务器上：`POST /dsh-pocket/<endpoint>`，loopback + 引擎会话 cookie 双重门禁。这个插件和引擎同进程，所以：

1. 用 `connection.authenticatedUrl()` 拿带 launch token 的入口地址，本机 `GET` 一次换回 `dsh-auth-*` cookie；
2. 换不到就走 dsh-pocket 的代理端口，用局域网密码换 cookie；
3. 都拿不到就退化成只读：直接读 `$DSH_HOME/dsh-pocket/` 下的状态文件，面板照常显示二维码、地址、密码，但改动类按钮会明说「只能看不能改」。

不复制密码文件、不伪造接口、不缓存配置。

## 卸载

```sh
dsh plugin --profile web remove dsh-go-pocket
rm -rf "$DSH_HOME/dsh-go/plugins/dsh-go-pocket"
```

再从 `cordis.patch.yml` 里删掉那条 insert（安装器备份在 `cordis.patch.yml.bak-dsh-go-pocket-*`）。

## 开发

```sh
node "$DSH_HOME/skills/dsh-go-plugin/kit/bin/check.mjs" . --load --lang zh
```

改了 `lib/` 里的代码，要在 App 的「引擎」页重启引擎才生效；改 `package.json` 的清单会自动重读。

## 许可

MIT。dsh-pocket 本身是 GPL-2.0，本插件不包含它的代码，只调用它的 HTTP 接口。
