import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const variantClasses = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary:
    'bg-white text-ink border border-line hover:bg-surface focus-visible:outline-brand-600',
  ghost: 'text-ink-muted hover:bg-surface hover:text-ink focus-visible:outline-brand-600',
  danger: 'bg-danger-600 text-white hover:bg-danger-500/90 focus-visible:outline-danger-600',
  outline:
    'bg-transparent text-brand-600 border border-brand-200 hover:bg-brand-50 focus-visible:outline-brand-600',
} as const

const sizeClasses = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses
  size?: keyof typeof sizeClasses
  isLoading?: boolean
  /** Render as the single child element (e.g. a react-router Link) instead of a <button>. */
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const sharedClassName = cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      className,
    )

    if (asChild) {
      return (
        <Slot ref={ref} className={sharedClassName} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={sharedClassName}
        {...props}
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
