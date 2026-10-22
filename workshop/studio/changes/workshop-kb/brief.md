# Plugin Brief: workshop-kb

> Created: 2026-03-29

## Business Context

园本知识库管理插件——导入、索引、查询学校本地教学资料（区编教材、园本理念、历年教案、教研记录）。为其他插件提供本地化知识支持，使课程设计能参考过往经验。

## Plugin Candidates

3 个 skills：kb-import（文档导入）、kb-index（知识库索引）、kb-query（知识库查询）

## Success Criteria

- 教师能快速导入已有教案和教材
- 其他插件设计时能自动引用本校历史资料
- 知识库支持增量更新

## Notes

- 知识库存储在 studio/kb/ 目录下，按分类组织
- 依赖 workshop-core（工作区管理）
- 被 workshop-5step、workshop-pbl、workshop-planner 引用
