# shshell 项目指南

## 项目概述

shshell（view）是一个混合终端模拟器和 shell 的图形化终端应用，灵感来自 Warp 等超级终端。它将传统 shell 的输入输出改为 DOM 元素渲染，实现可视化的 shell 交互体验。

核心特性：
- 自由编辑输入，支持鼠标点击跳转和选择替换
- 传统shell使用了整个tui，多轮对话在一个ui里，这里直接自己实现了shell，拆分每次对话
- 基于 DOM 的输出渲染，可控制显示每个输入输出单元
- 支持本地 shell 和 SSH 远程连接
- Tab 补全和命令提示（基于 Fig autocomplete 规范）
- 多标签页支持
- 终端备选缓冲区（支持 vim 等全屏程序）

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 39 |
| 构建工具 | electron-vite 4 |
| 语言 | TypeScript 5 |
| UI 库 | dkh-ui（自定义轻量 UI 库） |
| 终端模拟（仅用于测试对照） | @xterm/xterm 6 |
| 进程管理 | node-pty（本地） |
| SSH 连接 | ssh2 |
| 测试 | Vitest |
| 代码规范 | Biome |
| 包管理 | pnpm |
| 命令补全 | @withfig/autocomplete |
| 模糊搜索 | fuse.js |
| 字符宽度 | simple-wcswidth |

## 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器（electron-vite dev）

# 构建
pnpm build            # 构建 renderer + main（electron-vite build）
pnpm pack             # 构建并打包目录（不生成安装包）
pnpm dist             # 构建并生成安装包

# 测试
pnpm vitest           # 运行测试
pnpm vitest run       # 运行一次测试

# 代码规范
pnpm biome check .    # 检查代码
pnpm biome format .   # 格式化代码
```

## 项目结构

```
shshell/
├── src/
│   ├── main/
│   │   └── main.ts              # Electron 主进程入口
│   ├── renderer/
│   │   ├── main.html            # Renderer 入口 HTML
│   │   ├── try.ts               # 通用 try-catch 工具函数
│   │   └── sh/
│   │       ├── sh.ts            # 核心：Sh 类（shell 执行）+ Page 类（UI 交互）
│   │       ├── parser_in.ts     # Shell 输入解析器（分词、引号、转义、括号）
│   │       ├── parser_out.ts    # 终端输出解析器（ANSI 转义序列、SGR、光标控制）
│   │       ├── output_render.ts # DOM 终端渲染器（替代 xterm.js 的自定义渲染）
│   │       ├── input_complete.ts # Tab 补全（文件路径、命令、Fig 规范）
│   │       ├── path_match_cursor.ts # 路径光标定位（路径段分割匹配）
│   │       └── test/            # 测试文件
│   └── vite-env.d.ts
├── docs/
│   └── shell.md                 # 自定义 shell 语法规范设计
├── assets/                      # 图标资源
├── electron.vite.config.ts      # electron-vite 配置
├── electron-builder.config.js   # 打包配置
├── biome.json                   # Biome 代码规范配置
├── vitest.config.ts             # Vitest 测试配置
└── package.json
```

## 架构说明

### Electron 双进程模型

```
Main Process (src/main/main.ts)
  ├── 创建 BrowserWindow
  ├── 应用生命周期管理
  └── 开发模式检测

Renderer Process (src/renderer/)
  ├── sh.ts          → 顶层入口，初始化 UI 和事件
  ├── parser_in.ts   → 输入解析
  ├── parser_out.ts  → 输出解析
  ├── output_render.ts → DOM 渲染
  └── input_complete.ts → 补全逻辑
```

### 核心模块

#### Sh 类（sh.ts:16）
Shell 执行引擎，封装本地 pty 和 SSH 远程执行：
- `run()` 方法返回统一的 `onData/onExit/write` 接口
- 本地模式使用 node-pty spawn
- SSH 模式使用 ssh2 exec

#### Page 类（sh.ts:121）
单个终端页面的 UI 和交互管理：
- 输入区域：prompt 渲染 + textarea 输入 + 补全提示
- 历史区域：命令输出展示
- Tab 管理：多标签页支持
- 面板布局：Planes 系统支持分屏

#### 输入解析（parser_in.ts）
把输入的shell命令解析为ast（注意这里是自定义了部分语法）

两层解析：
1. `parseInFlat()` - 扁平分词：处理空格、引号（单/双）、转义、括号、注释
2. `parseIn2()` - 语义分类：标记 main（命令）、arg（参数）、blank（空白）

输出类型 `ShInputItem`：
- `type: "item"` - 普通 token
- `type: "blank"` - 空白字符
- `type: "sub"` - 括号嵌套（子命令）
- `type: "ignore"` - 注释
- `type: "()"` - 括号符号

#### 输出解析（parser_out.ts）
序列解析参考： https://terminalguide.namepad.de/seq/

ANSI 转义序列（ESC协议）解析，支持：
- **SGR 样式**：颜色（16/256/真彩色）、粗体、斜体、下划线、删除线、反转、隐藏等 已经完全实现
- **光标控制**：上下左右移动、绝对/相对定位、保存/恢复光标位置
- **编辑操作**：换行、清行、清屏、擦除 部分支持
- **模式切换**：备选缓冲区切换（?1049） 部分支持 参考： https://terminalguide.namepad.de/mode/
- **键盘输入映射**：key2seq() 将键盘事件转为终端序列

还有鼠标点击、图片显示等协议，部分来自iterm2等终端定义

也是解析为ast类似物和指令

#### DOM 渲染器（output_render.ts）
替代 xterm.js 的自定义渲染引擎：
- `Render` 类：将解析后的 token 渲染为 DOM 元素
- 支持宽字符（wcswidth）正确处理
- 备选缓冲区（altbuf）模式
- 内联输入框实现光标效果

#### 补全系统（input_complete.ts）
Tab 触发的智能补全：
- 命令名补全：从 PATH 扫描可执行文件
- 文件路径补全：目录遍历 + Fuse.js 模糊匹配
- Fig 规范补全：加载 @withfig/autocomplete 规范文件
- `cd` 特殊处理：只补全目录

### UI 框架 dkh-ui

项目使用自定义 UI 库 `dkh-ui`，核心 API：
- `view()` - 创建 div 容器
- `txt()` - 创建文本节点
- `button()` - 创建按钮
- `textarea()` - 创建文本框
- `input()` - 创建输入框
- `spacer()` - 创建弹性间距
- `.add()` / `.addInto()` - 添加子元素
- `.style()` - 设置样式
- `.on()` - 绑定事件
- `.sv()` / `.gv` - 设置/获取值
- `.clear()` - 清空子元素
- `addClass()` - 创建可复用样式类

## 代码约定

### 格式（Biome）
- 缩进：空格，宽度 4
- 行宽：120 字符
- 导入排序：启用
- Lint 规则：recommended，`noExplicitAny` 为 info 级别

### TypeScript 风格
- 允许使用 `any`（项目中 node-pty、ssh2 等外部类型通过 `as typeof import()` 断言）
- 使用 `require()` 导入 Node.js 模块（Renderer 进程中可用）
- 驼峰命名变量和函数，PascalCase 命名类
- 无分号风格（Biome 格式化）

### 文件组织
- 每个源文件聚焦单一职责
- 测试文件放在 `src/renderer/sh/test/` 下，与源文件同名 + `.test.ts`
- 类型定义与实现放在同一文件（不单独建 types 文件）

## 自定义 Shell 语法

参见 `docs/shell.md`，设计要点：

- 基本结构：`command arg1 arg2`，空格分隔参数
- 引号：自动匹配，只需转义引号内的引号
- 转义：未引用参数中 `\` + 特殊字符转义
- 重定向：`>`（stdout）、`2>`（stderr）、`&>`（both）
- 管道：`|`（stdout）、`|2`（stderr）、`|&`（both）
- 子命令：`(subcommand)` 作为参数
- 变量：`set x v` 定义，`$x` 引用
- 函数：`function name (commands)`
- 别名：`alias a b` 等同于 `function a (b)`
- 注释：`#` 开头

## 开发注意事项

1. **Renderer 进程直接使用 Node API**：`nodeIntegration: true, contextIsolation: false`，所以 renderer 中可以直接 `require('node:fs')` 等
2. **node-pty 依赖原生模块**：安装/构建需要系统有编译工具链
4. **Fig 自动补全**：通过动态 `import()` 加载规范文件，已外部化 `@withfig/autocomplete/dynamic`
5. **SSH 功能**：ssh2 模块功能尚在早期实现阶段，仅支持基本 exec
6. **测试覆盖**：测试文件位于 `src/renderer/sh/test/`，使用 Vitest 框架

## 关键文件速查

| 需求 | 文件 |
|------|------|
| 修改 UI 布局 | `src/renderer/sh/sh.ts`（Page 类） |
| 修改输入解析规则 | `src/renderer/sh/parser_in.ts` |
| 修改输出渲染/样式 | `src/renderer/sh/output_render.ts` |
| 添加新的 ANSI 转义序列 | `src/renderer/sh/parser_out.ts` |
| 修改补全逻辑 | `src/renderer/sh/input_complete.ts` |
| 修改构建配置 | `electron.vite.config.ts` |
| 修改打包配置 | `electron-builder.config.js` |
| 修改代码规范 | `biome.json` |
