import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader className="items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Página não encontrada</CardTitle>
            <CardDescription>
              O endereço acessado não existe ou foi movido.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button size="sm" asChild>
            <Link to="/dashboard">Voltar ao painel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
