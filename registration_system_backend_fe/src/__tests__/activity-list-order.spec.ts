import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const currentDir = dirname(fileURLToPath(import.meta.url))
const querySource = readFileSync(
  resolve(currentDir, '../../../registration_system_rs/src/activity/adapters/persistence/query.rs'),
  'utf-8',
)

describe('activity list ordering', () => {
  it('loads activity list newest first by match time', () => {
    expect(querySource).toContain('ORDER BY holding_date DESC, id DESC')
    expect(querySource).not.toContain('ORDER BY holding_date ASC\n             LIMIT')
  })
})
