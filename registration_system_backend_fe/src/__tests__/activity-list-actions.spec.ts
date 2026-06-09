import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, '../views/activities/ActivityList.vue'), 'utf-8')
const detailSource = readFileSync(
  resolve(currentDir, '../views/activities/ActivityDetail.vue'),
  'utf-8',
)
const editDialogSource = readFileSync(
  resolve(currentDir, '../views/activities/ActivityEditDialog.vue'),
  'utf-8',
)

describe('ActivityList actions', () => {
  it('shows explicit row actions for activity operations', () => {
    expect(source).toContain('activity-row-actions')
    expect(source).toContain('查看')
    expect(source).toContain('编辑')
    expect(source).toContain('删除')
  })

  it('only exposes quick status changes from registering activities', () => {
    expect(source).toContain('v-if="activity.status === 0"')
    expect(source).toContain('设为已结束')
    expect(source).toContain('设为已取消')
    expect(source).toContain('changeStatus(activity.id, 2)')
    expect(source).toContain('changeStatus(activity.id, 3)')
  })

  it('keeps home and away jersey colors on the same edit form row', () => {
    expect(source).toContain('activity-jersey-color-row')
    expect(source.indexOf('球服颜色')).toBeLessThan(source.indexOf('对手球服颜色'))
  })

  it('uses players_per_team as match format and submits editable team capacity limit', () => {
    expect(source).toContain('const DEFAULT_TEAM_CAPACITY_MULTIPLIER = 2')
    expect(source).toContain('team_capacity_limit: null as number | null')
    expect(source).toContain('target.players_per_team = Number(target.match_format)')
    expect(source).toContain('v-model.number="form.team_capacity_limit"')
    expect(source).toContain('shouldRefreshDefaultTeamCapacityLimit(')
    expect(source).toContain(
      'team_capacity_limit: normalizeTeamCapacityLimit(form.team_capacity_limit) ?? undefined',
    )
    expect(source).toContain(
      'team_capacity_limit: normalizeTeamCapacityLimit(form.team_capacity_limit)',
    )
    expect(source).not.toContain('Number(target.match_format) * DEFAULT_PLAYERS_LIMIT_MULTIPLIER')
    expect(source).not.toContain('readonly')
  })

  it('keeps activity detail edit form consistent with editable team capacity limit', () => {
    expect(editDialogSource).toContain('v-model.number="form.team_capacity_limit"')
    expect(detailSource).toContain('shouldRefreshDefaultTeamCapacityLimit(')
    expect(detailSource).toContain(
      'team_capacity_limit: normalizeTeamCapacityLimit(editForm.team_capacity_limit)',
    )
    expect(detailSource).toContain('defaultTeamCapacityLimit(a.players_per_team)')
  })
})
