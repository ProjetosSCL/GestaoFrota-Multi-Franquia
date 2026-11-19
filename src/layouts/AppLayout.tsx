import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, LogOut, Menu, Settings } from 'lucide-react'

import { Logo } from '@/components/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/contexts/AuthContext'
import { initials } from '@/lib/format'
import {
  APP_NAME,
  APP_VERSION,
  ROLE_LABELS,
  navItemForPath,
  visibleGroups,
  type NavGroup,
} from '@/lib/roles'
import { cn } from '@/lib/utils'

function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const location = useLocation()
  const current = navItemForPath(location.pathname)

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon
            const active = current?.to === item.to

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon
                  className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-white/50')}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter({ role }: { role: string }) {
  return (
    <div className="border-t border-sidebar-border px-4 py-4">
      <p className="text-xs font-medium text-white/80">{role}</p>
      <p className="mt-1 text-[11px] text-white/40">
        {APP_VERSION} · Fundação
      </p>
    </div>
  )
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  if (!profile) return null

  const groups = visibleGroups(profile.role)
  const current = navItemForPath(location.pathname)
  const franchiseLabel = profile.franchise
    ? `${profile.franchise.name}`
    : 'Todas as franquias'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <Logo variant="onDark" />
        </div>
        <SidebarNav groups={groups} />
        <SidebarFooter role={ROLE_LABELS[profile.role]} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-[280px] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white/70"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">
            Navegação da sua franquia no Fleet SCL.
          </SheetDescription>
          <div className="border-b border-sidebar-border px-4 py-5">
            <Logo variant="onDark" />
          </div>
          <SidebarNav groups={groups} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter role={ROLE_LABELS[profile.role]} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">
              {current?.label ?? APP_NAME}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {current?.description ?? 'Gestão de frota, combustível, manutenção e estoque.'}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="max-w-[220px] truncate">{franchiseLabel}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label="Menu do usuário">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(profile.full_name)}
                  </span>
                  <span className="hidden max-w-[160px] truncate text-sm font-medium md:block">
                    {profile.full_name}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{profile.full_name}</span>
                    <span className="text-xs text-muted-foreground">{franchiseLabel}</span>
                    <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
                      {ROLE_LABELS[profile.role]}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => void handleSignOut()}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>

        <footer className="px-4 pb-6 text-[11px] text-muted-foreground lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t pt-4">
            <span>
              {APP_NAME} · {APP_VERSION}
            </span>
            <span>Layout base da Fundação — os módulos operacionais chegam na Fase 2.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
