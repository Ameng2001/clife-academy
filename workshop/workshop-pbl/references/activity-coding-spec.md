# Activity Coding Specification

PBL 活动编码规范，用于项目探究阶段中各活动的唯一标识与管理。

---

## Coding Format

```
PBL-C{clue_number}-{sequence_number}
```

| 字段 Field | 说明 Description | 取值 Values |
|------------|-----------------|-------------|
| `PBL` | 固定前缀 (fixed prefix) | `PBL` |
| `C{clue_number}` | 探究线索编号 (inquiry clue number) | `C1`, `C2`, `C3` |
| `{sequence_number}` | 活动序号，两位数字，补零 (zero-padded) | `01`, `02`, `03`... |

示例: `PBL-C1-01`, `PBL-C2-03`, `PBL-C3-01`

---

## Rules

1. **线索内连续编号 (Sequential within clue)**：同一线索内活动按设计顺序编号，不跳号
2. **线索间重置 (Reset per clue)**：每条新线索的序号从 `01` 重新开始
3. **一活动一编码 (One code per activity)**：每个编码对应且仅对应一个活动
4. **编码不可变 (Codes are stable)**：编码一旦分配，不因活动调整而重新编号；删除活动时该编码作废，不回收复用

编号序列示例:

```
C1-01, C1-02, C1-03, C1-04
C2-01, C2-02, C2-03
C3-01, C3-02, C3-03, C3-04, C3-05
```

---

## Activity Naming Convention

### 中文名称

- 长度: **2-6 个汉字**
- 要求: 简洁描述活动核心内容
- 示例: 我喜欢的果汁、果汁制作工具、果汁大调查、开张准备

### 英文名称

- 长度: **2-5 个单词**
- 要求: 与中文名称含义对应，首字母大写
- 示例: My Favorite Juice, Juice Making Tools, Juice Survey, Grand Opening

### 双语展示格式 (Bilingual Display)

```
PBL-C{n}-{nn} 中文名称 / English Name
```

示例:

```
PBL-C1-01 我喜欢的果汁 / My Favorite Juice
PBL-C1-02 果汁大调查 / Juice Survey
PBL-C2-01 果汁制作工具 / Juice Making Tools
PBL-C3-01 开张准备 / Grand Opening
```

---

## Activity Table Format

每个活动在项目文档中以四列表格呈现:

| 列 Column | 说明 Description |
|-----------|-----------------|
| **关键问题 Key Questions** | 本活动要回答的核心问题，1-2 个 |
| **活动 Activities** | 活动名称（含编码） |
| **内容 Contents** | 活动的具体步骤描述，3-4 步 |
| **资源 Resources** | 所需材料、场地、人员等 |

---

## Examples

以"果汁小铺"项目为例:

### 线索 1: 认识果汁 (Getting to Know Juice)

| 关键问题 | 活动 | 内容 | 资源 |
|---------|------|------|------|
| 你最喜欢什么果汁？为什么？ | PBL-C1-01 我喜欢的果汁 / My Favorite Juice | 1. 品尝 3-4 种果汁，描述口感<br>2. 投票选出最受欢迎的果汁<br>3. 绘制"我最爱的果汁"画作 | 苹果汁、橙汁、葡萄汁、西瓜汁各 500ml；一次性品尝杯 25 个；投票贴纸 |
| 水果里藏着什么秘密？ | PBL-C1-02 水果大发现 / Fruit Discovery | 1. 观察 5 种水果的外形、颜色、气味<br>2. 切开水果，观察内部结构<br>3. 用放大镜观察果肉纹理，记录发现 | 苹果、橙子、葡萄、西瓜、柠檬各 2 个；切板、安全刀具；放大镜 5 个；观察记录表 |
| 果汁是怎么来的？ | PBL-C1-03 果汁从哪来 / Where Does Juice Come From | 1. 观看果汁工厂视频（3 分钟）<br>2. 讨论果汁的制作过程<br>3. 排序"从水果到果汁"流程卡片 | 果汁生产视频；流程排序卡片 6 张/组 |

### 线索 2: 探究果汁制作 (Exploring Juice Making)

| 关键问题 | 活动 | 内容 | 资源 |
|---------|------|------|------|
| 做果汁需要什么工具？ | PBL-C2-01 果汁制作工具 / Juice Making Tools | 1. 展示 3 种榨汁方式（手挤、压榨器、榨汁机）<br>2. 分组尝试不同工具榨橙汁<br>3. 比较出汁量，讨论哪种最好用 | 手动压榨器 3 个；小型榨汁机 1 台；橙子 15 个；量杯 3 个 |
| 怎样让果汁更好喝？ | PBL-C2-02 果汁配方师 / Juice Recipe Creator | 1. 品尝纯果汁和混合果汁<br>2. 自由搭配 2-3 种水果制作混合果汁<br>3. 为自己的配方起名并绘制配方卡 | 各类果汁原料；量杯；搅拌棒；空白配方卡 |

### 线索 3: 开设果汁小铺 (Opening the Juice Shop)

| 关键问题 | 活动 | 内容 | 资源 |
|---------|------|------|------|
| 果汁小铺需要准备什么？ | PBL-C3-01 开张准备 / Grand Opening | 1. 讨论开店需要的物品和分工<br>2. 制作菜单牌、价格标签、店铺招牌<br>3. 布置果汁小铺区域 | 卡纸、彩笔、剪刀、胶水；小桌椅；围裙 |
| 怎样招待客人？ | PBL-C3-02 小小服务员 / Little Server | 1. 观看服务员工作视频，讨论待客礼仪<br>2. 角色扮演：点单、制作、上果汁<br>3. 互相评价服务表现 | 点单本、围裙、托盘；角色扮演道具 |
| 我们的果汁小铺开业啦！ | PBL-C3-03 果汁小铺开业 / Juice Shop Grand Opening | 1. 邀请其他班级和家长参观<br>2. 各岗位幼儿协作运营果汁小铺<br>3. 收集顾客反馈，总结开业体验 | 全部果汁制作材料；邀请函；顾客反馈表 |
