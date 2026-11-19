import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  Package,
  PackageMinus,
  PackagePlus,
  ReceiptText,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type Role = 'central_admin' | 'franchise_manager' | 'agent' | 'purchasing'

export const ROLES: Role[] = ['central_admin', 'franchise_manager', 'agent', 'purchasing']

export const ROLE_LABELS: Record<Role, string> = {
  central_admin: 'Administrador Central',
  franchise_manager: 'Gestor da Franquia',
  agent: 'Agente',
  purchasing: 'Compras',
}

export const APP_NAME = 'Fleet SCL'
export const APP_VERSION = 'v0.1 · Fase 1'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles: Role[]
  description: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      {
        label: 'Painel',
        to: '/dashboard',
        icon: LayoutDashboard,
        roles: ['central_admin', 'franchise_manager', 'agent', 'purchasing'],
        description: 'Indicadores e alertas da sua unidade.',
      },
    ],
  },
  {
    label: 'Frota',
    items: [
      {
        label: 'Veículos',
        to: '/vehicles',
        icon: Truck,
        roles: ['central_admin', 'franchise_manager', 'agent', 'purchasing'],
        description: 'Frota da unidade, quilometragem e quem está de posse.',
      },
      {
        label: 'Abastecimento',
        to: '/fuel/new',
        icon: Fuel,
        roles: ['central_admin', 'franchise_manager', 'agent'],
        description: 'Registrar abastecimento com recibo.',
      },
      {
        label: 'Manutenção',
        to: '/maintenance/new',
        icon: Wrench,
        roles: ['central_admin', 'franchise_manager', 'agent'],
        description: 'Registrar manutenção realizada.',
      },
      {
        label: 'Regras de manutenção',
        to: '/maintenance-rules',
        icon: ClipboardList,
        roles: ['central_admin', 'franchise_manager'],
        description: 'Intervalos por km ou tempo, o que vencer primeiro.',
      },
    ],
  },
  {
    label: 'Estoque',
    items: [
      {
        label: 'Estoque',
        to: '/inventory',
        icon: Package,
        roles: ['central_admin', 'franchise_manager', 'agent', 'purchasing'],
        description: 'Saldo, mínimo e validade dos itens.',
      },
      {
        label: 'Dar entrada',
        to: '/inventory/entry',
        icon: PackagePlus,
        roles: ['central_admin', 'franchise_manager', 'purchasing'],
        description: 'Entrada de compra no estoque.',
      },
      {
        label: 'Retirada',
        to: '/inventory/withdraw',
        icon: PackageMinus,
        roles: ['central_admin', 'franchise_manager', 'agent'],
        description: 'Retirar peça vinculada a um veículo.',
      },
      {
        label: 'Catálogo de itens',
        to: '/inventory/item-types',
        icon: ShieldAlert,
        roles: ['central_admin'],
        description: 'Itens padrão da rede e durabilidade do fabricante.',
      },
      {
        label: 'Reembolsos',
        to: '/reimbursements',
        icon: ReceiptText,
        roles: ['central_admin', 'franchise_manager', 'purchasing'],
        description: 'Solicitações de compra e aprovação.',
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        label: 'Alertas',
        to: '/alerts',
        icon: Bell,
        roles: ['central_admin', 'franchise_manager', 'agent', 'purchasing'],
        description: 'Manutenção a vencer, estoque baixo e itens vencendo.',
      },
      {
        label: 'Relatórios',
        to: '/reports',
        icon: BarChart3,
        roles: ['central_admin', 'franchise_manager'],
        description: 'Custos por franquia, veículo e período.',
      },
      {
        label: 'Franquias',
        to: '/franchises',
        icon: Building2,
        roles: ['central_admin'],
        description: 'As unidades da rede.',
      },
      {
        label: 'Colaboradores',
        to: '/users',
        icon: Users,
        roles: ['central_admin', 'franchise_manager'],
        description: 'Usuários, papéis e status.',
      },
      {
        label: 'Configurações',
        to: '/settings',
        icon: Settings,
        roles: ['central_admin', 'franchise_manager', 'agent', 'purchasing'],
        description: 'Seu perfil, telefone e senha.',
      },
    ],
  },
]

export function canAccess(role: Role | undefined, roles: Role[]) {
  return !!role && roles.includes(role)
}

export function navItemForPath(pathname: string): NavItem | undefined {
  const items = NAV_GROUPS.flatMap((group) => group.items)
  return items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
}

export function visibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)
}
