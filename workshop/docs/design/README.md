# 教研工坊设计文档索引

`Astra Studio` 平台层文档已迁移到：

- [astra-shell/frontend/docs/design/README.md](/Users/liuyameng/Codes/floppy/astra-shell/frontend/docs/design/README.md)

当前目录只保留 `course-workshop-plugins` 相关的行业插件集合与教研工坊设计文档。

## 行业插件集合层（教研工坊）

0. [教研工坊-行业插件集合设计方案.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-行业插件集合设计方案.md)

推荐阅读顺序：

1. [教研工坊-产品概念方案.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-产品概念方案.md)
2. [教研工坊-页面级产品方案.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面级产品方案.md)
3. [教研工坊-页面视觉与交互设计稿.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面视觉与交互设计稿.md)
4. [教研工坊-页面视觉与交互设计稿-v2.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面视觉与交互设计稿-v2.md)
5. [教研工坊-页面视觉与交互设计稿-v2.2.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面视觉与交互设计稿-v2.2.md)
6. [教研工坊-页面视觉与交互设计稿-v2.4.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面视觉与交互设计稿-v2.4.md)
7. [教研工坊-页面视觉与交互设计稿-v3.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-页面视觉与交互设计稿-v3.md)
8. [教研工坊-组件与交互设计.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-组件与交互设计.md)
9. [教研工坊-前端数据与路由设计.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-前端数据与路由设计.md)
11. [教研工坊-分享到幼师学坊.md](教研工坊-分享到幼师学坊.md)：交付页「分享到幼师学坊」按钮、四栏表、令牌与回写（插件 skill `workshop-core:share` 是参考实现）
10. [教研工坊-Bridge与技术实现方案.md](/Users/liuyameng/.codex/worktrees/8a4e/courses-workshop-plugins/docs/design/教研工坊-Bridge与技术实现方案.md)

递进关系：

- `教研工坊-行业插件集合设计方案`：定义 `course-workshop-plugins` 如何作为课程设计行业插件集合挂载到 Astra Studio 平台
- 产品概念方案：定义产品定位、主张、目标用户与核心体验
- 页面级产品方案：定义页面、用户路径与页面职责
- 页面视觉与交互设计稿：V1，任务驱动工作台方向
- 页面视觉与交互设计稿-v2：V2，单人沉浸式 Co-pilot 创作台方向
- 页面视觉与交互设计稿-v2.2：V2 的增强版，把结构雷达和沉浸式 Co-pilot 画布结合起来
- 页面视觉与交互设计稿-v2.4：参考 Claude 的工作方式，强调 Project / Thread、rich-rendered conversation 和 Context Rail
- 页面视觉与交互设计稿-v3：新的主方向，结构画布优先，Copilot 以 Drawer 方式附着在结构对象上工作
- 组件与交互设计：定义 UI 组件体系与交互边界
- 前端数据与路由设计：定义路由、view-model 与运行时映射
- Bridge 与技术实现方案：定义前端如何接入 `.workshop/` 与现有脚本能力
