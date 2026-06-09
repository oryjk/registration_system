import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const activityServiceSource = readFileSync(resolve(currentDir, '../services/activity.ts'), 'utf-8')
const activityListSource = readFileSync(
  resolve(currentDir, '../views/activities/ActivityList.vue'),
  'utf-8',
)
const activityDtoSource = readFileSync(
  resolve(currentDir, '../../../registration_system_rs/src/activity/adapters/web/dto.rs'),
  'utf-8',
)

describe('activity list registration preview', () => {
  it('exposes registration preview data on activity list items', () => {
    expect(activityServiceSource).toContain('registration_preview: ActivityRegistrationPreview')
    expect(activityDtoSource).toContain('pub registration_preview: ActivityRegistrationPreviewDto')
  })

  it('renders registration avatars and names in each activity card', () => {
    expect(activityListSource).toContain('activity-registration-preview')
    expect(activityListSource).toContain('previewMemberName')
    expect(activityListSource).toContain('previewMembersByStand')
    expect(activityListSource).toContain('activity-preview-avatar')
  })

  it('keeps the card preview compact with three visible status rows', () => {
    const groupsStart = activityListSource.indexOf('const registrationPreviewGroups')
    const groupsEnd = activityListSource.indexOf('const onFilterStatus')
    const groupsSource = activityListSource.slice(groupsStart, groupsEnd)

    expect(groupsSource).toContain("label: '已报名'")
    expect(groupsSource).toContain("label: '请假'")
    expect(groupsSource).toContain("label: '未表态'")
    expect(groupsSource).not.toContain("label: '迟到'")
    expect(activityListSource).toContain('class="mt-2 space-y-1.5"')
  })
})
