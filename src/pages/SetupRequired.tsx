import { DatabaseZap, ExternalLink } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME, APP_VERSION } from '@/lib/roles'

const steps = [
  'Crie/conecte o projeto no Supabase.',
  'Rode db/schemas.sql no SQL Editor (tabelas + RLS + helpers).',
  'Rode db/seed.sql (as 8 franquias e o admin de teste).',
  'Copie URL e anon key em Project Settings → API para o .env.local.',
]

export function SetupRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <Logo variant="onLight" className="justify-center" />

        <Card>
          <CardHeader className="items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <DatabaseZap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">Conecte o Supabase para começar</CardTitle>
              <CardDescription>
                O app está pronto, mas ainda não encontrou as credenciais do projeto.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm text-muted-foreground">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              <p># .env.local</p>
              <p>VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co</p>
              <p>VITE_SUPABASE_ANON_KEY=sua-anon-key</p>
            </div>

            <a
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Abrir o painel do Supabase
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          {APP_NAME} · {APP_VERSION}
        </p>
      </div>
    </div>
  )
}
