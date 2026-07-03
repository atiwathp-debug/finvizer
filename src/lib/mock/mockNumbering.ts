import type { DocumentType } from '@/types/document'
import type { NumberingSetting, ResetPolicy } from '@/types/numbering'

const NUMBERING_KEY = 'finvizer_mock_numbering_settings'

function readSettings(): NumberingSetting[] {
  try {
    const raw = localStorage.getItem(NUMBERING_KEY)
    return raw ? (JSON.parse(raw) as NumberingSetting[]) : []
  } catch {
    return []
  }
}

function writeSettings(settings: NumberingSetting[]) {
  localStorage.setItem(NUMBERING_KEY, JSON.stringify(settings))
}

export function listMockNumberingSettings(companyId: string): NumberingSetting[] {
  return readSettings().filter((s) => s.companyId === companyId)
}

/** Upserts by (companyId, documentType) — null documentType is the company-wide default. */
export function saveMockNumberingSetting(
  companyId: string,
  documentType: DocumentType | null,
  pattern: string,
  resetPolicy: ResetPolicy,
): NumberingSetting {
  const settings = readSettings()
  const index = settings.findIndex(
    (s) => s.companyId === companyId && s.documentType === documentType,
  )
  const now = new Date().toISOString()

  if (index === -1) {
    const created: NumberingSetting = {
      id: crypto.randomUUID(),
      companyId,
      documentType,
      pattern,
      resetPolicy,
      createdAt: now,
      updatedAt: now,
    }
    writeSettings([...settings, created])
    return created
  }

  const updated: NumberingSetting = { ...settings[index], pattern, resetPolicy, updatedAt: now }
  settings[index] = updated
  writeSettings(settings)
  return updated
}

/** Removes a per-document-type override, reverting that type back to the company-wide default. */
export function deleteMockNumberingSettingOverride(
  companyId: string,
  documentType: DocumentType,
): void {
  writeSettings(
    readSettings().filter((s) => !(s.companyId === companyId && s.documentType === documentType)),
  )
}
