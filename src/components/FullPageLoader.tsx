import { Loader2 } from 'lucide-react'

import { APP_NAME } from '@/lib/roles'

export function FullPageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {label} <span className="sr-only">{APP_NAME}</span>
      </p>
    </div>
  )
}
