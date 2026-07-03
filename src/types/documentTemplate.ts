import type { DocumentTemplateEnum } from '@/types/database'

export interface DocumentTemplateMeta {
  id: DocumentTemplateEnum
  name: string
  tagline: string
  description: string
  swatch: [string, string, string]
}

/** The 2 built-in document templates (Phase 2A) — every company must pick one before using the main document workflow. */
export const documentTemplateCatalog: DocumentTemplateMeta[] = [
  {
    id: 'EXECUTIVE_CLASSIC',
    name: 'Executive Classic',
    tagline: 'ทางการ น่าเชื่อถือ',
    description: 'โทนสีเข้ม เรียบหรู เหมาะกับงานบัญชี งานภาษี และเอกสารระดับองค์กรที่ต้องการความเป็นทางการ',
    swatch: ['#0f172a', '#334155', '#ffffff'],
  },
  {
    id: 'MODERN_ACCENT',
    name: 'Modern Accent',
    tagline: 'ทันสมัย โดดเด่นด้วยสีแบรนด์',
    description: 'โทนสีสดใส แยกแบรนด์ชัดเจน เหมาะกับบริษัทบริการและธุรกิจสายเทคโนโลยีที่ต้องการความทันสมัย',
    swatch: ['#4f46e5', '#10b981', '#f8fafc'],
  },
]

export function getDocumentTemplateMeta(id: DocumentTemplateEnum): DocumentTemplateMeta {
  return documentTemplateCatalog.find((template) => template.id === id) ?? documentTemplateCatalog[0]
}
