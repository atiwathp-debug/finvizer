import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-xl focus:outline-none md:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">เมนูนำทาง</DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-3 top-4 rounded-md p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
            aria-label="ปิดเมนู"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
          <Sidebar onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
