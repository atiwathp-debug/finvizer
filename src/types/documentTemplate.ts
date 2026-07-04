import type { DocumentTemplateEnum } from '@/types/database'

export interface DocumentTemplateMeta {
  id: DocumentTemplateEnum
  name: string
  tagline: string
  description: string
  swatch: [string, string, string]
}

/** The 3 built-in document templates — every company must pick one before using the main document workflow. */
export const documentTemplateCatalog: DocumentTemplateMeta[] = [
  {
    id: 'EXECUTIVE_CLASSIC',
    name: 'Executive Classic',
    tagline: 'ทางการ แบบฟอร์มธุรกิจไทย',
    description: 'กรอบชัดเจน หัวเอกสารจัดกึ่งกลาง มีกล่องข้อมูลลูกค้า/เอกสาร ตารางเส้นหนา เหมาะกับงานบัญชี งานภาษี และธุรกิจไทยที่ต้องการความน่าเชื่อถือ',
    swatch: ['#1e3a5f', '#334155', '#ffffff'],
  },
  {
    id: 'MODERN_ACCENT',
    name: 'Modern Accent',
    tagline: 'ทันสมัย โปร่งโล่ง สีส้มเด่น',
    description: 'เลย์เอาต์โปร่งโล่ง สีขาวเป็นหลัก เน้นสีส้มจุดเดียวที่ชื่อเอกสารและยอดรวม เหมาะกับบริษัทบริการและธุรกิจสายเทคโนโลยีที่ต้องการความทันสมัย',
    swatch: ['#ea580c', '#1e293b', '#f8fafc'],
  },
  {
    id: 'MINIMAL_PRINT',
    name: 'Minimal Print',
    tagline: 'แบบฟอร์มราชการ เรียบง่าย',
    description: 'เส้นขอบสีดำล้วน ไม่มีสีตกแต่งใด ๆ กล่องข้อมูลลูกค้า/เอกสารแบบฟอร์มทางการ เหมาะกับการพิมพ์เอกสารขาวดำและงานที่เน้นความเรียบง่าย',
    swatch: ['#000000', '#ffffff', '#000000'],
  },
]

export function getDocumentTemplateMeta(id: DocumentTemplateEnum): DocumentTemplateMeta {
  return documentTemplateCatalog.find((template) => template.id === id) ?? documentTemplateCatalog[0]
}
