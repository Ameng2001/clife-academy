---
name: kb-import
description: Import school-specific documents into the knowledge base with structured metadata extraction. Use when a teacher wants to add textbooks, past lesson plans, school philosophy, or teaching research records. Supports single files and directories.
allowed-tools: Read, Write, Glob, Bash
user-invocable: true
---

# Knowledge Base Import

Import documents into the school-specific knowledge base (`.workshop/kb/`). Extracts structured metadata and writes each document as a tagged markdown file for downstream skills to query.

## Expert Discovery

This skill uses **dynamic expert loading**. On every run:

1. **Primary role**: Resolve `early-childhood-curriculum-expert.md` using runtime scope order: `.workshop/agents/custom/` → `experts/` → `workshop-kb/agents/`
2. **Optional custom experts**: Glob `.workshop/agents/custom/*.md`
3. **Optional shared experts**: Glob `experts/*.md`
4. **Optional plugin-local experts**: Glob `workshop-kb/agents/*.md`
5. **Skip template**: Do not load `_domain-expert-template.md`

## Pre-check

1. Verify `.workshop/` exists. If not, tell the user to run `/workshop-core:init` first.
2. Verify `.workshop/kb/` directory exists. If not, create the directory structure:
   ```
   .workshop/kb/textbooks/
   .workshop/kb/philosophy/
   .workshop/kb/lesson-plans/
   .workshop/kb/research-records/
   .workshop/kb/calendars/
   ```

## Step 1: Identify Source

Read `$ARGUMENTS` to determine the import source:

- If a **file path** is provided, read the file
- If a **directory path** is provided, list all files in the directory
- If no path provided, ask the user:

> **请提供要导入的文件或目录路径。支持的内容类型：**
> 1. 📚 区编教材 — 放入 `textbooks/`
> 2. 🏫 园本理念/教育哲学 — 放入 `philosophy/`
> 3. 📝 历年教案/活动方案 — 放入 `lesson-plans/`
> 4. 📋 教研记录/观察记录 — 放入 `research-records/`
> 5. 📅 学期主题日历 — 放入 `calendars/`

## Step 2: Classify Document Type

For each document, determine its category by analyzing content:

| 关键特征 | 分类 | 目标目录 |
|---------|------|---------|
| 包含课程标准、教学大纲、单元主题规划 | textbook | `.workshop/kb/textbooks/` |
| 包含办园理念、课程哲学、园本特色描述 | philosophy | `.workshop/kb/philosophy/` |
| 包含教学目标、教学过程、活动步骤 | lesson-plan | `.workshop/kb/lesson-plans/` |
| 包含教研讨论记录、教师反思、观察笔记 | research-record | `.workshop/kb/research-records/` |
| 包含月/周/学期的主题安排表 | calendar | `.workshop/kb/calendars/` |

If classification is uncertain, ask the user to confirm.

## Step 3: Extract Metadata

For each document, extract the following metadata and build YAML frontmatter:

```yaml
---
title: "文档标题"
category: textbook | philosophy | lesson-plan | research-record | calendar
source_file: "原始文件路径"
import_date: "YYYY-MM-DD"
# 以下字段根据内容提取，不确定则留空
themes: ["主题1", "主题2"]         # 涉及的教学主题
age_groups: ["prek-3", "prek-4", "k"]  # 适用年龄段
domains: ["健康", "语言", "社会", "科学", "艺术"]  # 涉及的五大领域
methodology: "pbl | five-step | thematic-curriculum | mixed"  # 使用的教学法
term: "2025-春季"                  # 所属学期（如可识别）
author: "作者姓名"                 # 如可识别
tags: ["关键词1", "关键词2"]       # 额外关键词
---
```

## Step 4: Write to Knowledge Base

1. Generate a file name: `{category}/{date}-{sanitized-title}.md`
2. Write the file with YAML frontmatter + 原始内容（或结构化摘要）
3. For long documents (>500 行), write a summary version with key sections extracted, and note the original file path in metadata
4. For client delivery PDFs with weak text extraction, prefer a structured exemplar summary instead of dumping noisy OCR text. Extract reusable shapes such as:
   - theme narrative sample
   - theme network sample
   - monthly matrix sample
   - weekly arrangement sample
   - representative activity-type structures

## Step 5: Confirm Import

Present the import result:

```
✅ 已导入 {count} 个文档到知识库

| # | 文件 | 分类 | 主题 | 年龄段 |
|---|------|------|------|--------|
| 1 | {filename} | {category} | {themes} | {age_groups} |
| ... |

💡 运行 /workshop-kb:kb-index 更新索引
```

## Validation Rules

- 不导入空文件
- 不导入二进制文件（图片/视频等），但记录其路径到元数据的 `related_media` 字段
- 如果目标路径已存在同名文件，询问用户是覆盖还是跳过
- 每次导入后提醒用户运行 `kb-index` 更新索引

## Out of Scope

- This skill does NOT build the search index (use `kb-index`)
- This skill does NOT search the knowledge base (use `kb-query`)
- This skill does NOT handle multimedia files — only text-based documents
