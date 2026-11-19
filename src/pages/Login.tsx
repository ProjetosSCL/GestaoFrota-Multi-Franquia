import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'

import { FullPageLoader } from '@/components/FullPageLoader'
import { Logo } from '@/components/Logo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME, APP_VERSION } from '@/lib/roles'

type Mode = 'password' | 'magic' | 'forgot' | 'recovery'

const highlights = [
  'Cada unidade enxerga apenas os próprios dados.',
  'Abastecimento e manutenção direto do celular do agente.',
  'Alertas de vencimento e estoque sem depender de planilha.',
]

export function LoginPage() {
  const { session, loading, signInWithPassword, signInWithMagicLink, sendPasswordReset, updatePassword, authMessage, clearAuthMessage } =
    useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isRecoveryLink =
    new URLSearchParams(location.search).get('mode') === 'recovery' ||
    location.hash.includes('type=recovery')

  const [mode, setMode] = useState<Mode>(isRecoveryLink ? 'recovery' : 'password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recovered, setRecovered] = useState(false)

  useEffect(() => {
    if (isRecoveryLink) setMode('recovery')
  }, [isRecoveryLink])

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (loading) return <FullPageLoader label="Verificando sua sessão…" />

  if (session && mode !== 'recovery') {
    return <Navigate to={from} replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    clearAuthMessage()
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearAuthMessage()
    setError(null)
    setSubmitting(true)
    const result = await signInWithPassword(email.trim(), password)
    setSubmitting(false)
    if (result.error) setError(result.error)
  }

  async function handleMagicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearAuthMessage()
    setError(null)
    setSubmitting(true)
    const result = await signInWithMagicLink(email.trim())
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotice(`Enviamos um link de acesso para ${email.trim()}. Abra o email no celular para entrar.`)
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearAuthMessage()
    setError(null)
    setSubmitting(true)
    const result = await sendPasswordReset(email.trim())
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotice('Se existir uma conta com esse email, enviamos as instruções de recuperação.')
  }

  async function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearAuthMessage()
    setError(null)

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    const result = await updatePassword(password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setRecovered(true)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(circle at 15% 10%, rgba(14,116,144,0.55), transparent 45%), radial-gradient(circle at 85% 85%, rgba(8,145,178,0.35), transparent 50%)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Logo variant="onDark" />
        </div>

        <div className="relative max-w-lg space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
            Gestão de frota multi-franquia
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-white xl:text-4xl">
            A frota das 8 unidades, em um só lugar.
          </h2>
          <p className="text-sm leading-relaxed text-white/70">
            Do abastecimento no posto ao estoque da oficina: um registro único, com isolamento por
            franquia e o histórico de quem está de posse de cada veículo.
          </p>
          <ul className="space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Acesso por papel · RLS por franquia · Supabase
        </div>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo variant="onLight" />
          </div>

          {mode === 'recovery' ? (
            recovered ? (
              <div className="space-y-5">
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Senha atualizada</AlertTitle>
                  <AlertDescription>Você já pode entrar com a nova senha.</AlertDescription>
                </Alert>
                <Button className="w-full" onClick={() => navigate('/dashboard', { replace: true })}>
                  Ir para o painel
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : !session ? (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight">Link expirado</h1>
                  <p className="text-sm text-muted-foreground">
                    O link de recuperação não é mais válido. Solicite um novo email de recuperação.
                  </p>
                </div>
                <Button className="w-full" onClick={() => switchMode('forgot')}>
                  Solicitar novo link
                </Button>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleRecoverySubmit}>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight">Definir nova senha</h1>
                  <p className="text-sm text-muted-foreground">
                    Escolha uma senha com pelo menos 6 caracteres.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Não foi possível salvar</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar nova senha
                </Button>
              </form>
            )
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {mode === 'password' && 'Entrar'}
                  {mode === 'magic' && 'Entrar com link mágico'}
                  {mode === 'forgot' && 'Recuperar senha'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === 'password' && 'Use o email e a senha cadastrados pela sua franquia.'}
                  {mode === 'magic' && 'Receba um link de acesso no email — ideal para entrar pelo celular.'}
                  {mode === 'forgot' && 'Informe seu email para receber as instruções de recuperação.'}
                </p>
              </div>

              {authMessage && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Atenção</AlertTitle>
                  <AlertDescription>{authMessage}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Não foi possível continuar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {notice && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Verifique seu email</AlertTitle>
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              {mode === 'password' && (
                <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@franquia.com.br"
                        className="pl-9"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        className="pl-9"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => switchMode('forgot')}
                    >
                      Esqueci minha senha
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => switchMode('magic')}
                    >
                      Usar link mágico
                    </button>
                  </div>
                </form>
              )}

              {mode === 'magic' && (
                <form className="space-y-4" onSubmit={handleMagicSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="magic-email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@franquia.com.br"
                        className="pl-9"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar link de acesso
                  </Button>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => switchMode('password')}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar para email e senha
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form className="space-y-4" onSubmit={handleForgotSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@franquia.com.br"
                        className="pl-9"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar instruções
                  </Button>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => switchMode('password')}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar para email e senha
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="mt-10 text-center text-[11px] text-muted-foreground">
            {APP_NAME} · {APP_VERSION}
          </p>
        </div>
      </section>
    </div>
  )
}
