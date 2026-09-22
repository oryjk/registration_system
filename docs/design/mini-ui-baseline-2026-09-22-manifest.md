# mini UI 改版基线证据清单（2026-09-22）

> 本文中的旧组件名、旧 token 和基线样式只属于迁移/验收历史，不是现行开发规范。新工作以[统一设计系统](../../registration_system_mini/docs/mini-design-system.md)为准；基线 patch 仅用于回溯，不可用于恢复旧皮肤。

任务 0 冻结、任务 1 命名迁移执行后补充。目的：让 reviewer 可精确还原**命名迁移前**的工作区状态，不把任务 1 之后的状态当作基线。

- 基线定义：分支 `codex/mini-d-design`，HEAD `71c721b1dc3c0482accc5953bee4fe39be1d83c5`，加上本文「原始记录」所列的未提交/未跟踪文件。
- 核心工件：[`mini-ui-baseline-2026-09-22.patch`](mini-ui-baseline-2026-09-22.patch)——**自包含**（254KB，53 个条目）：15 个 tracked 文件的迁移前 diff（10 修改 + 5 删除）+ **全部 38 个基线未跟踪文件的实际内容**（3 个被迁移触碰组件的重建基线内容、13 个未触碰文本文件原字节、22 个图标文件含 10 个 PNG 二进制条目）。在 `71c721b` 干净检出上单条 `git apply` 即得完整基线状态，**不依赖当前工作区**。

## 一、原始记录（任务 0 时点捕获，未经任何修改）

`git status --short --branch`：

```text
## codex/mini-d-design...origin/codex/mini-d-design
 M registration_system_mini/src/components/AppTabHeader.vue
 M registration_system_mini/src/components/neo/NeoAvatarStack.vue
 M registration_system_mini/src/config/themePalettes.ts
 M registration_system_mini/src/pages/__tests__/homePageLoading.test.ts
 D registration_system_mini/src/pages/home/__tests__/otherMatchesState.test.ts
 D registration_system_mini/src/pages/home/components/HomeMatchSearch.vue
 D registration_system_mini/src/pages/home/components/HomeOtherMatchesSection.vue
 M registration_system_mini/src/pages/home/components/HomeTeamSwitcher.vue
 M registration_system_mini/src/pages/home/homeMatchState.ts
 M registration_system_mini/src/pages/home/index.vue
 D registration_system_mini/src/pages/home/otherMatchesState.ts
 D registration_system_mini/src/pages/home/useHomeOtherMatches.ts
 M registration_system_mini/src/stores/__tests__/theme.test.ts
 M registration_system_mini/src/styles/neo-tokens.css
 M registration_system_mini/src/types/viewModels.ts
?? docs/design/home-apple-2026-09-21.html
?? docs/design/home-glass-2026-09-21.html
?? docs/design/mini-d-rollout.md
?? docs/superpowers/plans/2026-09-22-mini-ui-unification.md
?? registration_system_mini/src/pages/home/__tests__/homeActionDeckState.test.ts
?? registration_system_mini/src/pages/home/__tests__/homeActionMatchCardState.test.ts
?? registration_system_mini/src/pages/home/__tests__/useHomeActionDeckDetails.test.ts
?? registration_system_mini/src/pages/home/__tests__/useHomeActionMatchCard.test.ts
?? registration_system_mini/src/pages/home/components/HomeActionMatchCard.vue
?? registration_system_mini/src/pages/home/components/HomeActionMatchDeck.vue
?? registration_system_mini/src/pages/home/components/HomeHeaderSearch.vue
?? registration_system_mini/src/pages/home/components/HomeMatchSearchResults.vue
?? registration_system_mini/src/pages/home/homeActionDeckState.ts
?? registration_system_mini/src/pages/home/homeActionMatchCardState.ts
?? registration_system_mini/src/pages/home/useHomeActionDeckDetails.ts
?? registration_system_mini/src/pages/home/useHomeActionMatchCard.ts
?? registration_system_mini/src/static/icons/
```

`git diff --stat`：

```text
 .../src/components/AppTabHeader.vue                |  14 +-
 .../src/components/neo/NeoAvatarStack.vue          |  25 +-
 .../src/config/themePalettes.ts                    |  33 ++-
 .../src/pages/__tests__/homePageLoading.test.ts    |  56 +++--
 .../pages/home/__tests__/otherMatchesState.test.ts |  53 -----
 .../pages/home/components/HomeMatchSearch.vue      | 264 ---------------------
 .../pages/home/components/HomeOtherMatchesSection.vue |  90 --------
 .../src/pages/home/components/HomeTeamSwitcher.vue | 115 +++------
 .../src/pages/home/homeMatchState.ts               |   1 +
 registration_system_mini/src/pages/home/index.vue  | 232 +++++++++---------
 .../src/pages/home/otherMatchesState.ts            |  26 --
 .../src/pages/home/useHomeOtherMatches.ts          |  71 ------
 .../src/stores/__tests__/theme.test.ts             |  13 +-
 .../src/styles/neo-tokens.css                      |  66 ++++--
 .../src/types/viewModels.ts                        |   2 +
 15 files changed, 307 insertions(+), 754 deletions(-)
```

任务 0 基线检查：`bun run type-check` exit 0；`bun test src/pages/home/__tests__ src/pages/__tests__/homePageLoading.test.ts src/stores/__tests__/theme.test.ts` 56 pass / 0 fail（该子集不含后来发现的 6 个失败文件，见 checklist 基线失败表）。

## 二、基线内容的重建方法与验证

任务 1 的迁移是**确定性固定串替换**（计划映射表 + 5 处注释措辞修改，全部记录在批次报告中）。基线中从未 staged/commit 过中间状态（git 无 blob），因此除「未触碰文件」外，基线内容按**精确逆变换**重建，并用以下三层证据验证：

1. **逐字节验证**：对 114 个「仅被命名迁移触碰」的 tracked 文件，逆变换(当前内容) == `git show HEAD:<旧路径>` 完全一致（含 13 个改名文件按旧路径比对）。若逆变换有任何假阳性/漏改，此步必然出现 diff。
2. **统计全等验证**：重建出的基线树执行 `git diff --stat HEAD`，输出与上方原始记录**逐文件、逐数字完全一致**（15 files, +307/−754，每个文件的 +/- 数全部吻合）。
3. **命名方向验证**：重建文件只含旧命名（`NeoAvatarStack`、`--neo-*` 等），不含任何 `--ui-` / `components/ui` / `App*` 新命名残留。

逆变换相对正向的两处必要修正（假阳性保护，已枚举穷尽）：预存在标识符 `activeMemberAvatarItems`、`openConfirmDialog` 本来就含新名子串，正向未触碰、逆向需跳过（`useConfirmDialog` 在 HEAD 无裸出现，不需保护）。

**局限声明**：10 个基线 M 文件与 3 个被触碰的未跟踪文件的基线内容是经上述验证的重建值，非当时磁盘字节的直接快照；其余全部文件（114 个 tracked 未修改项 + 16 个未触碰未跟踪条目 + 图标 22 文件 + 5 个删除文件的 HEAD blob）为直接原字节/原 blob，且未触碰未跟踪文件与图标的**实际内容已原样嵌入 patch**（复制时经 sha256 核对与基线一致）。

## 三、文件清单

### tracked 修改（基线内容在 patch 内，sha256 为重建基线字节）

| 文件（基线路径） | sha256 前 16 位 |
| --- | --- |
| `registration_system_mini/src/components/AppTabHeader.vue` | `ce56341518a80fd7` |
| `registration_system_mini/src/components/neo/NeoAvatarStack.vue` | `ca52007992b976da` |
| `registration_system_mini/src/config/themePalettes.ts` | `3909a0271e84adfa` |
| `registration_system_mini/src/pages/__tests__/homePageLoading.test.ts` | `0a5b167c9df0990f` |
| `registration_system_mini/src/pages/home/components/HomeTeamSwitcher.vue` | `dc408a3da0d3363a` |
| `registration_system_mini/src/pages/home/homeMatchState.ts` | `33e4127d575dd39c` |
| `registration_system_mini/src/pages/home/index.vue` | `1b81e07abb5dc523` |
| `registration_system_mini/src/stores/__tests__/theme.test.ts` | `666b96a4b7726fec` |
| `registration_system_mini/src/styles/neo-tokens.css` | `0b86f78625312c3e` |
| `registration_system_mini/src/types/viewModels.ts` | `8656d993d9952e2b` |

### tracked 删除（基线即"不存在"；内容可从 HEAD blob 取回）

| 文件 | HEAD blob 前 16 位 |
| --- | --- |
| `registration_system_mini/src/pages/home/__tests__/otherMatchesState.test.ts` | `d37497d6b0213e89` |
| `registration_system_mini/src/pages/home/components/HomeMatchSearch.vue` | `8dd4b957a8daed72` |
| `registration_system_mini/src/pages/home/components/HomeOtherMatchesSection.vue` | `a5334a50918471c6` |
| `registration_system_mini/src/pages/home/otherMatchesState.ts` | `4d012c99387dfb80` |
| `registration_system_mini/src/pages/home/useHomeOtherMatches.ts` | `636abf6163ef3460` |

### 未跟踪 · 被任务 1 迁移触碰（基线内容在 patch 内）

| 文件 | sha256 前 16 位 |
| --- | --- |
| `registration_system_mini/src/pages/home/components/HomeActionMatchCard.vue` | `1864bdc599fae7b3` |
| `registration_system_mini/src/pages/home/components/HomeHeaderSearch.vue` | `0412ff6d4532984a` |
| `registration_system_mini/src/pages/home/components/HomeMatchSearchResults.vue` | `fb9a1f1375d26c1b` |

### 未跟踪 · 从未触碰（基线字节已原样嵌入 patch；下表 sha256 用于校验）

| 文件 | sha256 前 16 位 |
| --- | --- |
| `docs/design/home-apple-2026-09-21.html` | `49b6d84850a8c71b` |
| `docs/design/home-glass-2026-09-21.html` | `6989a0159b7f8cab` |
| `docs/design/mini-d-rollout.md` | `77ce6784b430fead` |
| `docs/superpowers/plans/2026-09-22-mini-ui-unification.md` | `b1d496efd7a00368` |
| `registration_system_mini/src/pages/home/__tests__/homeActionDeckState.test.ts` | `f82c259ac840d1a4` |
| `registration_system_mini/src/pages/home/__tests__/homeActionMatchCardState.test.ts` | `1058df6a408e4b3c` |
| `registration_system_mini/src/pages/home/__tests__/useHomeActionDeckDetails.test.ts` | `40af0600f5686fed` |
| `registration_system_mini/src/pages/home/__tests__/useHomeActionMatchCard.test.ts` | `f47cf8b4190af70c` |
| `registration_system_mini/src/pages/home/components/HomeActionMatchDeck.vue` | `9cbbd2c2b46d7e14` |
| `registration_system_mini/src/pages/home/homeActionDeckState.ts` | `2e66dd0638e9abd1` |
| `registration_system_mini/src/pages/home/homeActionMatchCardState.ts` | `885ab140c9c4f41e` |
| `registration_system_mini/src/pages/home/useHomeActionDeckDetails.ts` | `9df8289d2d61f77a` |
| `registration_system_mini/src/pages/home/useHomeActionMatchCard.ts` | `d9a212ced54d90d1` |
| `registration_system_mini/src/static/icons/`（22 个文件，PNG/SVG/LICENSE/README） | 目录聚合摘要 `e9e08d2a83c7ee02`（`find … -type f \| sort \| xargs shasum -a 256 \| shasum -a 256` 前 16 位） |

## 四、还原步骤（reviewer 可复现，不依赖当前工作区）

```sh
# 在 71c721b 的干净检出上（git apply 支持其中的二进制条目）：
git apply docs/design/mini-ui-baseline-2026-09-22.patch
# → 完整基线状态一步还原：
#   · 15 个 tracked 文件（10 修改 + 5 删除）
#   · 3 个被迁移触碰组件的重建基线内容
#   · 13 个未触碰文本文件 + 22 个图标文件（原字节，PNG 走 GIT binary patch）
# 还原后可用第三节 sha256 逐文件校验。
```

自测记录（2026-09-22）：在 `git archive HEAD` 全新检出上 `git apply` 成功；抽查 `HomeActionMatchCard.vue`=`1864bdc599fae7b3`、`mini-d-rollout.md`=`77ce6784b430fead`、`HomeActionMatchDeck.vue`=`9cbbd2c2b46d7e14`、图标目录聚合摘要=`e9e08d2a83c7ee02`，与上表一致。
