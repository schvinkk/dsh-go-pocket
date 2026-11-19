# 出处与致谢 / Attribution

## 这个插件是从哪儿来的

`dsh-go-pocket` 是 **dsh-pocket 在 dsh-go 手机 App 原生界面上的适配层**。

- 上游项目：**dsh-pocket** — https://github.com/shaobeichen/dsh-pocket
- 上游作者：shaobeichen
- 上游许可：**GPL-2.0**
- 上游做了什么：把 Harness 装进口袋——局域网/公网二维码、访问密码、cloudflared 隧道、就绪度自愈、移动端适配。这些能力、协议和状态判定的设计全部来自上游。

## 本插件做了什么（不重复上游的活）

本插件**不包含 dsh-pocket 的任何源代码**，它只是：

1. 在 dsh-go 的原生界面里放一条状态条和三块面板（`lib/view.js`）；
2. 通过 dsh-pocket **自己暴露的 HTTP 控制接口** `POST /dsh-pocket/<endpoint>` 读写同一份状态（`lib/pocket.js`）；
3. 拿不到会话时只读地读 `$DSH_HOME/dsh-pocket/` 下的状态文件。

也就是说：**dsh-pocket 必须单独安装并启用**，本插件是它的遥控器，不是它的替代品。密码、隧道、设置文件都只有一份，不存在第二套配置。

## 许可证怎么处理

- 本插件自身的代码：**MIT**（见 LICENSE）。
- dsh-pocket：**GPL-2.0**。因为本插件不分发、不链接、不修改上游代码，只通过 HTTP 调用它的接口，所以 MIT 与之一致；但**如果你把上游代码合并进本仓库，整包必须转为 GPL-2.0**。

## 发布时请照抄这句话

> 本项目基于 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket)（作者 shaobeichen，GPL-2.0）提供的能力，做的是 **dsh-go 原生界面的适配层**；dsh-pocket 需单独安装，本插件不包含其源代码。

English:

> This project adapts [dsh-pocket](https://github.com/shaobeichen/dsh-pocket) (by shaobeichen, GPL-2.0) to the dsh-go native UI. dsh-pocket must be installed separately; no upstream source code is included.
