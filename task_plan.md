# Task Plan: claude-switch 实现

## Goal
实现交互式 CLI 工具 `claude-switch`，快速切换 Claude Code 的 Model API Provider。

## Design Spec
`docs/2026-04-01-claude-switch-design.md`

## Phases

### Phase 1: 项目脚手架 `complete`
- 初始化 TypeScript + Node.js 项目
- 配置 package.json（name: claude-switch, bin 入口）
- 安装依赖：@inquirer/prompts, typescript
- 配置 tsconfig.json
- 验收：`npm run build` 通过

### Phase 2: Provider 配置数据模型 `complete`
- 定义 Provider 类型和配置模板（4 个 Provider 的 env 变量映射）
- 定义 env 清理全集
- 实现 config 读写（`~/.claude-switch/config.json`）
- 实现 settings.json 读写（只操作 `env` 字段）
- 验收：单元测试覆盖 config 和 settings 的读写

### Phase 3: 切换核心逻辑 `complete`
- 实现 env 清理（全集 key 移除）
- 实现 Provider env 写入（按模板）
- 实现原生 env 备份/恢复
- 实现当前 Provider 检测
- 验收：单元测试覆盖切换场景（原生→第三方、第三方→第三方、第三方→原生）

### Phase 4: 交互式 TUI `complete`
- 一级菜单：Provider 选择（含状态标识 ● active / ✔ configured / ○ not configured）
- API Key 输入流程（未配置时拦截）
- 二级菜单：模型选择（含 Reconfigure API Key 选项）
- ESC 返回/退出逻辑
- MiniMax 单模型跳过选择
- Claude 原生跳过模型选择
- 验收：手动测试完整交互流程

### Phase 5: 集成与发布准备 `complete`
- CLI 入口 bin 配置
- npm link 本地测试
- 验收：`claude-switch` 命令可用，完整流程跑通

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| TS2591: Cannot find name 'node:fs/promises' | 1 | Added `"types": ["node"]` to tsconfig.json |
| TS2322: null not assignable to string/undefined | 1 | Split promptApiKey return handling with intermediate variable |
