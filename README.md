# dsh-sound-alert 🔊

> [English](README.en.md) | 中文

DSH（DeepSeek Harness）提示音插件：当**用户指定的目标完成**、**代理向你提问**或**代理回答完成**时，浏览器播放提示音。

- ✅ 安装即用，默认开启，无需额外配置
- ✅ 纯浏览器合成音（Web Audio）为主，**也可上传自定义音频**（常见格式，≤1MB）
- ✅ 零构建、零 npm 依赖（只使用平台自带的 react）
- ✅ 配置存 localStorage，重启/换会话都保留

## 功能

| 时机 | 触发源 | 默认声音 |
|---|---|---|
| 目标完成（`update_goal complete` / 自动完成） | 会话 goal 投影变为 `complete` | 880Hz 正弦 ×2 |
| 向用户提问（`ask_user_question` 弹出时） | 对话快照出现新的 `ask_user_question` 运行中调用 | 660Hz 三角波 ×3 |
| 回答完成（一轮思考/工作结束、最终回答给出） | 对话快照出现新的 turn/end | 784Hz 正弦 ×2 |

> 打开历史会话时不会重放旧事件（首次渲染只记录不发声）。

### 自定义声音

- **独立开关**：总开关之外，三种事件（目标完成 / 提问 / 回答完成）在设置页各有自己的开关，可单独静音某一种。
- **自定义音频**：设置页 →「提示音」→ 每个事件可上传自己的音频文件（mp3 / wav / ogg / m4a 等浏览器支持的常见格式，**单个 ≤ 1MB**，存为 data URL 保存在 localStorage）。设置了自定义音频后优先播放它，播放失败自动回退合成音；点「清除」恢复合成音。
- **合成音参数**：每个事件可调 波形 / 频率 / 时长 / 音量 / 重复次数 / 间隔，并可直接「试听」。
- **状态条**：输入框上方只保留一行极简状态（🔔 提示音已开启 / 🔕 提示音已关闭）。

## 安装

要求：已安装并运行过 DSH（Web 界面），存在用户配置目录 `~/.dsh/profiles/<profile>`（默认 profile 名是 `web`）。如果设置了 `DSH_HOME` 环境变量，配置目录则在 `$DSH_HOME/profiles/<profile>`。

无需安装任何工具（npm / dsh / pnpm 都不需要），从 GitHub 下载后一键安装：

### Windows 10 / 11

1. 在 GitHub 仓库页面点 **Code → Download ZIP**，下载并解压
2. 进入解压后的文件夹，**双击 `install.cmd`**（或在该文件夹的终端里运行 `.\install.cmd`）
3. 看到「OK. 安装完成」后，**完全退出并重启 DSH**

打开 Web 界面即可使用——输入框上方会出现「🔔 提示音已开启」。

> 安装到其他 profile：在终端运行 `.\install.cmd <profile名>`（默认 `web`）。

### macOS / Linux

1. 下载 ZIP 并解压，终端进入该文件夹
2. 运行 `./install.sh`
3. **完全退出并重启 DSH**

### 也可以让 Harness 帮你装

在 DSH 对话里说一句「帮我安装 dsh-sound-alert 插件」，把下载好的插件目录放进工作区，代理会自动完成安装，你只负责重启 DSH。

> 仓库里的 `install.cmd` / `install.ps1` / `install.sh` 是同一安装器的三种形式（分别对应 Windows 双击、PowerShell、bash），内容等价，任选其一。

## 卸载

同样可以让 Harness 帮你卸载；或者手动：

1. 删除 `cordis.patch.yml` 里追加的 `sound-alert` 段
2. 删除 `~/.dsh/profiles/<profile>/node_modules/dsh-sound-alert/`
3. 重启 DSH

## 工作原理（开发者）

DSH 的插件是 npm 包。安装脚本（`install.cmd` / `install.ps1` / `install.sh`）做的事就是：把包复制到 `~/.dsh/profiles/<profile>/node_modules/dsh-sound-alert/`，然后在 profile 的 `cordis.patch.yml` 里 `insert` 一行挂载条目：

- `package.json` 的 `dsh.client` 声明浏览器半区（`platform: "web"` + 依赖注入顺序）
- `exports["./client"]` 指向打包成 `window.__ModuleLoader__.load({ id, factory })` 格式的客户端 bundle（本项目手写，无需构建）
- `lib/index.js` 是 Host 半区占位（空 `apply`，让 Loader 认识这个包；本插件全部逻辑在浏览器侧）

检测逻辑（`lib/client.js`）：

- **目标完成**：订阅会话的 `goal` 投影（与官方 GoalBar 同一数据源），phase 从非 `complete` 变为 `complete` 时播放
- **提问**：`ask_user_question` 工具会一直"运行中"直到用户回答，所以监听对话快照的 `runningCalls` 中出现新的同名 `callId` 即播放——正好是提问弹出的一刻
- **回答完成**：监听对话快照 `turnEnds` 中出现新的 turn/end（一轮思考+工作收尾、最终回答给出的时刻）；首次渲染只记录已有 turn，不重放历史
- **自定义音频**：`<input type="file" accept="audio/*">` → FileReader 读为 data URL（≤1MB）存入配置，播放时优先 `new Audio(dataUrl)`，失败回退合成音

## License

[Apache-2.0](LICENSE) · Copyright 2026 [314159264](https://github.com/314159264)
