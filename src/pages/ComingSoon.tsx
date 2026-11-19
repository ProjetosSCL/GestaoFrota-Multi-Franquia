import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Construction } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { navItemForPath } from '@/lib/roles'

export function ComingSoonPage() {
  const location = useLocation()
  const item = navItemForPath(location.pathname)

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card>
        <CardHeader className="items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Construction className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <Badge variant="secondary">Fase 2</Badge>
            <CardTitle className="text-xl">{item?.label ?? 'Módulo em construção'}</CardTitle>
            <CardDescription>
              {item?.description ??
                'Esta parte do sistema entra na próxima fase do plano de construção.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A Fundação (Fase 1) entrega login, RLS por franquia e o layout base. Este módulo já tem
            rota, permissão por papel e lugar no menu — a implementação funcional chega na Fase 2,
            junto com as RPCs e Edge Functions descritas em <code>docs/FUNCTIONS.md</code>.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard">
              Voltar ao painel
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
