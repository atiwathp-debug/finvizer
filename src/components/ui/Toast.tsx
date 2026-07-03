import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useToastStore } from '@/stores/toastStore'

const toneStyles = {
  default: { icon: Info, className: 'border-line', iconClassName: 'text-brand-600' },
  success: { icon: CheckCircle2, className: 'border-accent-200', iconClassName: 'text-accent-600' },
  error: { icon: XCircle, className: 'border-red-200', iconClassName: 'text-red-600' },
} as const

/** Mounted once near the app root. Renders every toast pushed via toast(). */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
      {toasts.map((item) => {
        const { icon: Icon, className, iconClassName } = toneStyles[item.tone]
        return (
          <ToastPrimitive.Root
            key={item.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg',
              'data-[state=closed]:opacity-0',
              className,
            )}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', iconClassName)} aria-hidden="true" />
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-ink">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-1 text-sm text-ink-muted">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              className="text-ink-muted hover:text-ink"
              aria-label="ปิดการแจ้งเตือน"
            >
              ✕
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}
