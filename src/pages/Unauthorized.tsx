import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/lib/roles'

export function UnauthorizedPage() {
  const { profile } = useAuth()

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader className="items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Acesso não permitido</CardTitle>
            <CardDescription>
              {profile
                ? `Seu papel (${ROLE_LABELS[profile.role]}) não tem permissão para esta página.`
                : 'Você não tem permissão para acessar esta página.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se precisar desse acesso no dia a dia, fale com o administrador central ou com o gestor
            da sua franquia.
          </p>
          <Button size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao painel
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
