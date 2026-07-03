import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteMockNumberingSettingOverride,
  listMockNumberingSettings,
  saveMockNumberingSetting,
} from './mockNumbering'

beforeEach(() => {
  localStorage.clear()
})

describe('saveMockNumberingSetting', () => {
  it('creates the company-wide default (documentType = null)', () => {
    const setting = saveMockNumberingSetting(
      'company-1',
      null,
      '{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}',
      'MONTHLY',
    )

    expect(setting.documentType).toBeNull()
    expect(setting.pattern).toBe('{DOC_TYPE}-{YYYY}{MM}{DD}-{RUNNING:4}')
    expect(setting.resetPolicy).toBe('MONTHLY')
    expect(listMockNumberingSettings('company-1')).toHaveLength(1)
  })

  it('creates a separate row for a per-document-type override', () => {
    saveMockNumberingSetting('company-1', null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    saveMockNumberingSetting(
      'company-1',
      'INVOICE',
      '{DOC_TYPE}-{YYYY}-{RUNNING:5}',
      'YEARLY',
    )

    const settings = listMockNumberingSettings('company-1')
    expect(settings).toHaveLength(2)
    expect(settings.find((s) => s.documentType === null)?.resetPolicy).toBe('MONTHLY')
    expect(settings.find((s) => s.documentType === 'INVOICE')?.resetPolicy).toBe('YEARLY')
  })

  it('updates in place (upsert) instead of duplicating on a second save', async () => {
    const first = saveMockNumberingSetting(
      'company-1',
      null,
      '{DOC_TYPE}-{YYYY}-{RUNNING:4}',
      'MONTHLY',
    )
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = saveMockNumberingSetting(
      'company-1',
      null,
      '{DOC_TYPE}-{YYYY}-{RUNNING:5}',
      'NEVER',
    )

    expect(second.id).toBe(first.id)
    expect(second.pattern).toBe('{DOC_TYPE}-{YYYY}-{RUNNING:5}')
    expect(second.resetPolicy).toBe('NEVER')
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThan(new Date(first.updatedAt).getTime())
    expect(listMockNumberingSettings('company-1')).toHaveLength(1)
  })

  it('keeps settings scoped per company', () => {
    saveMockNumberingSetting('company-1', null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    saveMockNumberingSetting('company-2', null, '{DOC_TYPE}-{YY}-{RUNNING:3}', 'DAILY')

    expect(listMockNumberingSettings('company-1')).toHaveLength(1)
    expect(listMockNumberingSettings('company-2')).toHaveLength(1)
  })
})

describe('deleteMockNumberingSettingOverride', () => {
  it('removes only the matching override, leaving the default intact', () => {
    saveMockNumberingSetting('company-1', null, '{DOC_TYPE}-{YYYY}-{RUNNING:4}', 'MONTHLY')
    saveMockNumberingSetting('company-1', 'INVOICE', '{DOC_TYPE}-{YYYY}-{RUNNING:5}', 'YEARLY')

    deleteMockNumberingSettingOverride('company-1', 'INVOICE')

    const settings = listMockNumberingSettings('company-1')
    expect(settings).toHaveLength(1)
    expect(settings[0].documentType).toBeNull()
  })
})
