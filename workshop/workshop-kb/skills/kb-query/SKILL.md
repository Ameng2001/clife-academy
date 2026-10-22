---
name: kb-query
description: Search the school knowledge base by theme, age group, domain, or keyword. Use when designing a lesson and needing school-specific materials, when looking for past lesson plans on a topic, or when someone asks "do we have anything about spring" or "find past lessons on animals".
allowed-tools: Read, Glob
user-invocable: true
---

# Knowledge Base Query

Search the school-specific knowledge base by theme, age group, domain, methodology, or free-text keyword. Returns matched documents with relevance summaries.

## Pre-check

1. Verify `.workshop/kb/index.yaml` exists. If not, tell the user:
   "知识库索引不存在。请先运行 `/workshop-kb:kb-index` 构建索引。"
2. Read `.workshop/kb/index.yaml`

## Step 1: Parse Query

Read `$ARGUMENTS` and extract search criteria:

- **主题关键词** (theme): Free-text keywords like "春天", "动物", "交通"
- **年龄段** (age_group): prek-3 / prek-4 / k
- **领域** (domain): 健康/语言/社会/科学/艺术
- **分类** (category): textbook / lesson-plan / research-record / philosophy / calendar
- **教学法** (methodology): pbl / five-step / thematic-curriculum / mixed
- **学期** (term): e.g., "2025-春季"

If `$ARGUMENTS` is a simple string (e.g., "春天"), treat it as a theme keyword search.

If no arguments provided, ask:

> **请输入搜索条件：**
> - 主题关键词（如"春天"、"动物"）
> - 可选限定：年龄段、领域、分类
>
> 示例: `春天` 或 `春天 中班 科学`

## Step 2: Filter Index

Apply filters against the index:

1. **Theme match**: Check if any item in `themes` or `tags` contains the keyword (fuzzy match)
2. **Age group match**: Check if `age_groups` contains the specified age group
3. **Domain match**: Check if `domains` contains the specified domain
4. **Category match**: Check if `category` matches
5. **Methodology match**: Check if `methodology` matches

Scoring: Documents matching more criteria rank higher. Theme match carries the highest weight.

## Step 3: Retrieve Top Results

1. Sort matched documents by relevance score (descending)
2. Take top 10 results
3. For each result, read the first 20 lines of the actual document to extract a brief summary

## Step 4: Display Results

```
🔍 知识库检索: "{query}"
共找到 {total_matches} 个相关文档，显示前 {display_count} 个：

┌─────────────────────────────────────────────────┐
│ [1] {title}                                     │
│     分类: {category} | 年龄段: {age_groups}       │
│     主题: {themes} | 领域: {domains}              │
│     摘要: {first_2_lines_of_content}...          │
│     路径: {file_path}                            │
├─────────────────────────────────────────────────┤
│ [2] ...                                         │
└─────────────────────────────────────────────────┘

💡 使用 Read 工具查看完整文档内容
```

## Integration with Other Skills

This skill is designed to be called by other skills (not just by users):

- **workshop-insight:theme-analysis** — 查询与主题相关的校本资料
- **workshop-insight:prior-knowledge** — 查询往年同主题的幼儿经验记录
- **workshop-5step:lesson-objective** — 查询过去同主题的教学目标设定
- **workshop-planner:semester-plan** — 查询往年学期主题安排

When called programmatically, the query returns structured data (file paths + metadata) rather than formatted display.

## Out of Scope

- This skill does NOT import documents (use `kb-import`)
- This skill does NOT modify the index (use `kb-index`)
- Full-text search within document bodies is approximate — it relies on metadata tags, not a search engine
