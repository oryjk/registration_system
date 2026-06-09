import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(currentDir, '../views/activities/ActivityList.vue'), 'utf-8')

describe('ActivityList route state', () => {
  it('defaults activity status filter to registering', () => {
    expect(source).toContain('const DEFAULT_ACTIVITY_STATUS_FILTER = 0')
    expect(source).toContain('const filterStatus = ref(DEFAULT_ACTIVITY_STATUS_FILTER)')
  })

  it('persists status and pagination options in route query', () => {
    expect(source).toContain('useRoute')
    expect(source).toContain('status: String(filterStatus.value)')
    expect(source).toContain('page: String(listPage.value)')
    expect(source).toContain('page_size: String(listPageSize.value)')
    expect(source).toContain('syncListStateToRoute')
    expect(source).toContain('applyListRouteQuery')
  })
})
