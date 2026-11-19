# 参与

## 跑起来

```sh
git clone https://github.com/schvinkk/dsh-go-pocket.git
cd dsh-go-pocket
npm test                                          # 12 个单元测试
node "$DSH_HOME/skills/dsh-go-plugin/kit/bin/check.mjs" . --load --lang zh --app 1.2.0
```

`check.mjs` 来自 dsh-go App 自带的 dsh-go-plugin 技能，退出码 0 才算过。

## 装到本机试

```sh
node bin/install.mjs            # 注册进 web profile 并补 cordis.patch.yml
```

改完 `lib/` 下的代码后**必须重启引擎**才会生效——原生插件在引擎启动时一次性读清单，热改文件不会重载。

## 提 PR

- 一次只改一件事，说明里写清动机
- 不要把真实地址、密码、二维码截图提交进仓库
- 新增面板或胶囊要同步更新 `package.json` 的 `dshGo.contributes`，否则检查器会报未注册
- 保留 `NOTICE.md` 里的上游出处，别删

## 上游

本插件是 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket) 的适配层。二维码、密码、隧道这些能力有问题，去上游提；只有「在 dsh-go 原生界面里显示/操作」这一层的问题才属于这里。
