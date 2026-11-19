import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/roles'

export interface FranchiseSummary {
  name: string
  state: string
  city: string
}

export interface Profile {
  id: string
  franchise_id: string | null
  full_name: string
  role: Role
  phone_e164: string | null
  is_active: boolean
  franchise: FranchiseSummary | null
}

interface ProfileRow extends Omit<Profile, 'franchise'> {
  franchise: FranchiseSummary | null
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  authMessage: string | null
  clearAuthMessage: () => void
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) return 'Email ou senha inválidos.'
  if (normalized.includes('email not confirmed')) return 'Confirme seu email antes de entrar.'
  if (normalized.includes('signups not allowed')) {
    return 'Não encontramos uma conta com esse email. Peça ao gestor da sua franquia para cadastrá-lo.'
  }
  if (normalized.includes('user not found')) {
    return 'Não encontramos uma conta com esse email.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }
  if (normalized.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (normalized.includes('expired') || normalized.includes('invalid token')) {
    return 'O link expirou. Solicite um novo.'
  }
  if (normalized.includes('error sending') || normalized.includes('smtp')) {
    return 'Não foi possível enviar o email agora. Tente novamente em alguns instantes.'
  }

  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setAuthMessage('Não foi possível restaurar sua sessão. Entre novamente.')
        setLoading(false)
        return
      }
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return
    let active = true

    setLoading(true)
    setProfileError(null)

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, franchise_id, full_name, role, phone_e164, is_active, franchise:franchises(name, state, city)',
        )
        .eq('id', userId)
        .maybeSingle()

      if (!active) return

      if (error) {
        setProfile(null)
        setProfileError(
          'Não foi possível carregar seu perfil. Verifique a conexão e tente novamente.',
        )
        setLoading(false)
        return
      }

      const row = data as ProfileRow | null

      if (!row) {
        setProfile(null)
        setProfileError(
          'Seu login ainda não tem perfil vinculado a uma franquia. Peça ao gestor para concluir o cadastro.',
        )
        setLoading(false)
        return
      }

      if (!row.is_active) {
        setProfile(null)
        setAuthMessage('Sua conta está desativada. Fale com o gestor da sua franquia.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      setProfile({ ...row, franchise: row.franchise ?? null })
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [userId, reloadToken])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: translateAuthError(error.message) }
    return { error: null }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) return { error: translateAuthError(error.message) }
    return { error: null }
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?mode=recovery`,
    })
    if (error) return { error: translateAuthError(error.message) }
    return { error: null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: translateAuthError(error.message) }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    setReloadToken((token) => token + 1)
  }, [])

  const clearAuthMessage = useCallback(() => setAuthMessage(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      authMessage,
      clearAuthMessage,
      signInWithPassword,
      signInWithMagicLink,
      sendPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      profileError,
      authMessage,
      clearAuthMessage,
      signInWithPassword,
      signInWithMagicLink,
      sendPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.')
  return context
}
