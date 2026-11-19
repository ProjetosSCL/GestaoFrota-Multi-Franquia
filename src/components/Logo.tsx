import { Truck } from 'lucide-react'

import { APP_NAME } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'onDark' | 'onLight'
  showWordmark?: boolean
  className?: string
}

export function Logo({ variant = 'onDark', showWordmark = true, className }: LogoProps) {
  const onDark = variant === 'onDark'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
          onDark ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-primary text-primary-foreground',
        )}
      >
        <Truck className="h-5 w-5" aria-hidden="true" />
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <p className={cn('text-base font-semibold tracking-tight', onDark ? 'text-white' : 'text-foreground')}>
            {APP_NAME}
          </p>
          <p className={cn('text-[11px]', onDark ? 'text-white/60' : 'text-muted-foreground')}>
            Gestão de frota da rede
          </p>
        </div>
      )}
    </div>
  )
}
