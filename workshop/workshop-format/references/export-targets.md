# 导出目标模型 / Export Targets

## local-markdown-bundle

用途：
- 本地交付审核
- release bundle 二次整理

输出：
- `.workshop/exports/{workspace}/local-markdown-bundle/`
- 保留 Markdown 源文件

## word-ready-bundle

用途：
- 为后续 `.docx` 生成器准备输入

输出建议：
- `manifest.yaml`
- `manifest.json`
- `lesson-plan.formatted.md`
- `assets/`

manifest 至少应包含：
- `profile.layout_profile`
- `profile.renderer = docx-placeholder`
- `profile.page`
- `profile.cover`
- `profile.header_footer`
- `profile.typography`
- `profile.table_mapping`
- `profile.naming`

## pdf-ready-bundle

用途：
- 为后续 PDF 渲染器准备输入

输出建议：
- 与 `word-ready-bundle` 相同
- 可附加页眉页脚和版式参数占位

manifest 至少应包含：
- `profile.layout_profile`
- `profile.renderer = pdf-placeholder`
- `profile.page`
- `profile.cover`
- `profile.header_footer`
- `profile.layout`
- `profile.naming`

## remote-bundle-placeholder

用途：
- 为后续 MCP/COS/S3 发布保留统一打包结构

注意：
- 当前阶段只定义目录与 manifest 结构
- 不直接接远端发布能力

manifest 至少应包含：
- `profile.renderer = remote-placeholder`
- `profile.remote_hint`
- `profile.naming`

## 命名约定

所有 export target 建议统一使用：

- 目录：`.workshop/exports/{workspace}/{target}/`
- 主教案源：`lesson-plan.formatted.md`
- 主预案源：`proposal.md`
- 说明文件：
  - `manifest.yaml`
  - `manifest.json`
