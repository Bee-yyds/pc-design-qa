# 维护与验证

以下步骤供维护者和 Codex 在隔离目录执行。实际验收资料保存在使用者项目中。

## 准备与引导场景

使用[场景表](onboarding-scenarios.md)逐项演练。记录观察到的下一轮问题、复用字段、验证动作和受阻事项。人工场景核对与真实新用户操作分别记录结果。

## 结构与模板

使用当前安装的 `skill-creator` 结构校验脚本检查本目录，检查 Markdown 相对链接和发布包内容。

报告数据及模板复制测试只依赖 Node.js，可在本目录执行。

```bash
node scripts/test-skill.mjs
```

该命令在系统临时目录创建模拟报告，输出隔离目录位置。它检查稳定编号、截图尺寸、独立需求和已有报告保护。

完整模板验证使用当前 Sites 技能提供的官方基础项目。准备独立目录，安装其依赖，把模拟报告通过 `scripts/apply-template.mjs` 应用到该目录。按 Sites 当前流程配置本地存储、构建和预览。

在本目录执行以下检查，把参数替换为隔离预览目录或地址。

```bash
node scripts/test-order.mjs /absolute/path/to/isolated-preview
node scripts/test-history.mjs /absolute/path/to/isolated-preview
node scripts/test-collaboration.mjs http://127.0.0.1:5181
```

协作检查会修改本地模拟数据，使用全新测试数据库。测试内容包括两种独立状态、撤销、描述和备注、并发冲突及历史。跨账号访问需要可用的真实账号另行验证。

## 发布前核对

- 核对 Skill 结构、相对引用、许可证和安装入口。
- 按实际行为检查首次引导和配置复用，示例文案符合零代码设计师的表达要求。
- 核对通用模板和隔离样例，检查真实项目域名、节点、人员、发布身份、凭据及截图是否误入目录。
- 记录本次实际通过的测试及验证限制。

GitHub 发布和分享 ZIP 按当次明确授权执行。日常修改同步项目源文件与本机安装版，原分享包保留上次发布内容。
