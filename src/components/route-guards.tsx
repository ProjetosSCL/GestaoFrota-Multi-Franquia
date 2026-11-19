import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { FullPageLoader } from '@/components/FullPageLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { canAccess, type Role } from '@/lib/roles'

export function RequireAuth() {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader label="Verificando seu acesso…" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle>Perfil indisponível</CardTitle>
            <CardDescription>
              {profileError ??
                'Não foi possível carregar seu perfil. Fale com o gestor da sua franquia.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button className="sm:flex-1" onClick={() => void refreshProfile()}>
              Tentar novamente
            </Button>
            <Button variant="outline" className="sm:flex-1" onClick={() => void signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}

export function RequireRole({ allowed }: { allowed: Role[] }) {
  const { profile } = useAuth()

  if (!profile) return null
  if (!canAccess(profile.role, allowed)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
