# Plugin Brief: workshop-core

> Created: 2026-03-28

## Business Context

课研工作台的基础设施插件——初始化工作区、追踪预案研发状态、归档已交付的预案。类似 astra-studio 的 studio-core，为其他插件提供共享工作区管理。

## Plugin Candidates

3 个 skills：init（初始化工作区）、status（查看状态）、promote（归档已完成预案）

## Success Criteria

- 新项目 30 秒内完成工作区初始化
- 课研主任能一眼看到所有在研预案的进度

## Notes

- 工作区目录结构与 astra-studio 一致（studio/changes/, studio/archive/）
- config.yaml 存储课研工作室的默认配置
