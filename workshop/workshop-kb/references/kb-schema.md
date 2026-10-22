# 知识库文档规范 / Knowledge Base Document Schema

## 文档分类体系

| 分类 ID | 中文名称 | 目录 | 典型内容 |
|---------|---------|------|---------|
| `textbook` | 区编教材 | `.workshop/kb/textbooks/` | 课程标准摘要、单元主题大纲、教学建议 |
| `philosophy` | 园本理念 | `.workshop/kb/philosophy/` | 办园理念、课程哲学、园本特色课程描述 |
| `lesson-plan` | 历年教案 | `.workshop/kb/lesson-plans/` | 完整教案、活动方案、PBL 预案、主题课程包样例 |
| `research-record` | 教研记录 | `.workshop/kb/research-records/` | 集体教研记录、个人教学反思、观察笔记 |
| `calendar` | 学期日历 | `.workshop/kb/calendars/` | 学期主题安排表、月度/周度计划 |

## 文档 Frontmatter 规范

每个导入的文档必须包含以下 YAML frontmatter：

```yaml
---
# === 必填字段 ===
title: string           # 文档标题
category: enum          # textbook | philosophy | lesson-plan | research-record | calendar
source_file: string     # 原始文件路径
import_date: date       # 导入日期 (YYYY-MM-DD)

# === 可选字段（尽量提取）===
themes: [string]        # 涉及的教学主题关键词
age_groups: [enum]      # prek-3 | prek-4 | k
domains: [enum]         # 健康 | 语言 | 社会 | 科学 | 艺术
methodology: enum       # pbl | five-step | thematic-curriculum | mixed | other
local_goal_system: string # 客户/园所本地目标编码体系（如 "HEPU-SE"）
goal_codes: [string]    # 文档中出现的本地目标编码（如 ["SE-4", "SE-8"]）
term: string            # 所属学期（如 "2025-春季"）
author: string          # 作者
tags: [string]          # 额外关键词/标签
related_media: [string] # 关联的媒体文件路径（图片/视频）
---
```

## 标签约定

### 主题标签 (themes)

使用幼儿园常见月度主题关键词：

- 自然类：春天、夏天、秋天、冬天、植物、动物、水、天气
- 社会类：我周围的人、职业、交通工具、社区、节日
- 自我类：我的身体、食物、健康习惯、情绪
- 文化类：中国传统文化、国际理解、多元文化

### 年龄段标签 (age_groups)

| 标签 | 年龄范围 | 对应班级 |
|------|---------|---------|
| `prek-3` | 3-4 岁 | 小班 |
| `prek-4` | 4-5 岁 | 中班 |
| `k` | 5-6 岁 | 大班 |

### 领域标签 (domains)

对应《3-6 岁儿童学习与发展指南》五大领域：
- 健康（身体运动、生活习惯、安全）
- 语言（倾听表达、阅读准备、书写准备）
- 社会（人际交往、社会适应、自我认知）
- 科学（探究能力、数学认知、自然认知）
- 艺术（感受欣赏、表现创造）

## 索引结构 (index.yaml)

索引文件由 `/workshop-kb:kb-index` 自动生成，包含：

1. **stats** — 统计信息（按分类、年龄段、领域的文档计数）
2. **documents** — 所有文档的元数据列表（不含正文内容）

索引用于快速过滤，实际内容读取时按需加载文档文件。

## 本地目标编码接入原则

当客户或园所使用自定义发展目标编码时：

1. 将编码体系名称记录在 `local_goal_system`
2. 将文档中出现的编码记录在 `goal_codes`
3. 这些字段用于：
   - 过滤样例
   - few-shot 参考
   - 输出时保留客户编码

注意：
- 本地目标编码不替代平台活动编码
- 本地目标编码也不替代《指南》对齐关系
