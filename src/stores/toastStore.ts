import { create } from 'zustand'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export { useToastStore }

interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
}

/** Fire-and-forget toast trigger — usable from anywhere, not just components. */
export function toast({ title, description, tone = 'default' }: ToastOptions) {
  const id = crypto.randomUUID()
  useToastStore.setState((state) => ({
    toasts: [...state.toasts, { id, title, description, tone }],
  }))
  return id
}
