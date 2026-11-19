import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Building2,
  Fuel,
  Loader2,
  PackageX,
  RefreshCw,
  ReceiptText,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatDateTime, formatKm, startOfMonth } from '@/lib/format'
import type { Role } from '@/lib/roles'

interface VehicleRow {
  id: string
  plate: string
  model: string | null
  vehicle_type: string
  current_odometer_km: number
  current_assignee_id: string | null
  assignee: { full_name: string } | null
}

interface FuelRow {
  id: string
  cost: number
  fueled_at: string
  odometer_km: number
  vehicle: { plate: string } | null
}

interface MaintenanceRow {
  id: string
  cost: number
  service_description: string
  performed_at: string
  vehicle: { plate: string } | null
}

interface AlertRow {
  id: string
  alert_type: string
  message: string
  status: string
  created_at: string
}

interface StockRow {
  quantity_on_hand: number
  min_quantity: number
}

interface DashboardData {
  vehicles: VehicleRow[]
  fuelMonth: { cost: number }[]
  maintenanceMonth: { cost: number }[]
  recentFuel: FuelRow[]
  recentMaintenance: MaintenanceRow[]
  alerts: AlertRow[]
  alertsOpen: number
  stockLow: number
  reimbursementsOpen: number
  franchiseCount: number
}

const ALERT_LABELS: Record<string, string> = {
  maintenance_due: 'Manutenção',
  stock_low: 'Estoque baixo',
  item_expiring: 'Item vencendo',
}

const ROLE_SCOPE: Record<Role, string> = {
  central_admin: 'Visão consolidada de toda a rede.',
  franchise_manager: 'Indicadores da sua unidade.',
  agent: 'Seus veículos e seus registros.',
  purchasing: 'Estoque e reembolsos da sua unidade.',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function sumCost(rows: { cost: number }[]) {
  return rows.reduce((total, row) => total + Number(row.cost ?? 0), 0)
}

const EMPTY_DATA: DashboardData = {
  vehicles: [],
  fuelMonth: [],
  maintenanceMonth: [],
  recentFuel: [],
  recentMaintenance: [],
  alerts: [],
  alertsOpen: 0,
  stockLow: 0,
  reimbursementsOpen: 0,
  franchiseCount: 0,
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-6 w-20" />
          ) : (
            <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const role = profile?.role

  const load = useCallback(async () => {
    if (!profile || !role) return

    setLoading(true)
    setError(null)

    const monthStartIso = startOfMonth().toISOString()

    let vehiclesQuery = supabase
      .from('vehicles')
      .select(
        'id, plate, model, vehicle_type, current_odometer_km, current_assignee_id, assignee:profiles(full_name)',
      )
      .eq('is_active', true)
      .order('plate', { ascending: true })

    if (profile.franchise_id) vehiclesQuery = vehiclesQuery.eq('franchise_id', profile.franchise_id)
    if (role === 'agent') vehiclesQuery = vehiclesQuery.eq('current_assignee_id', profile.id)

    let fuelMonthQuery = supabase.from('fuel_records').select('cost').gte('fueled_at', monthStartIso)
    let maintenanceMonthQuery = supabase
      .from('maintenance_records')
      .select('cost')
      .gte('performed_at', monthStartIso)
    let recentFuelQuery = supabase
      .from('fuel_records')
      .select('id, cost, fueled_at, odometer_km, vehicle:vehicles(plate)')
      .order('fueled_at', { ascending: false })
      .limit(5)
    let recentMaintenanceQuery = supabase
      .from('maintenance_records')
      .select('id, cost, service_description, performed_at, vehicle:vehicles(plate)')
      .order('performed_at', { ascending: false })
      .limit(5)

    if (profile.franchise_id) {
      fuelMonthQuery = fuelMonthQuery.eq('franchise_id', profile.franchise_id)
      maintenanceMonthQuery = maintenanceMonthQuery.eq('franchise_id', profile.franchise_id)
      recentFuelQuery = recentFuelQuery.eq('franchise_id', profile.franchise_id)
      recentMaintenanceQuery = recentMaintenanceQuery.eq('franchise_id', profile.franchise_id)
    }

    if (role === 'agent') {
      fuelMonthQuery = fuelMonthQuery.eq('created_by', profile.id)
      maintenanceMonthQuery = maintenanceMonthQuery.eq('created_by', profile.id)
      recentFuelQuery = recentFuelQuery.eq('created_by', profile.id)
      recentMaintenanceQuery = recentMaintenanceQuery.eq('created_by', profile.id)
    }

    let alertsQuery = supabase
      .from('alerts')
      .select('id, alert_type, message, status, created_at')
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: false })
      .limit(4)

    if (profile.franchise_id) alertsQuery = alertsQuery.eq('franchise_id', profile.franchise_id)

    const alertsCountQuery = supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    const franchiseCountQuery = supabase
      .from('franchises')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    const stockQuery = supabase.from('inventory_stock').select('quantity_on_hand, min_quantity')
    const reimbursementsQuery = supabase
      .from('reimbursement_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')

    const [
      vehiclesResult,
      fuelMonthResult,
      maintenanceMonthResult,
      recentFuelResult,
      recentMaintenanceResult,
      alertsResult,
      alertsCountResult,
      franchiseCountResult,
      stockResult,
      reimbursementsResult,
    ] = await Promise.all([
      vehiclesQuery,
      fuelMonthQuery,
      maintenanceMonthQuery,
      recentFuelQuery,
      recentMaintenanceQuery,
      alertsQuery,
      alertsCountQuery,
      franchiseCountQuery,
      stockQuery,
      reimbursementsQuery,
    ])

    const firstError =
      vehiclesResult.error ??
      fuelMonthResult.error ??
      maintenanceMonthResult.error ??
      recentFuelResult.error ??
      recentMaintenanceResult.error ??
      alertsResult.error ??
      alertsCountResult.error ??
      franchiseCountResult.error ??
      stockResult.error ??
      reimbursementsResult.error

    if (firstError) {
      setError(`Não foi possível consultar os dados agora. ${firstError.message}`)
      setLoading(false)
      return
    }

    const stockRows = (stockResult.data ?? []) as unknown as StockRow[]

    setData({
      vehicles: (vehiclesResult.data ?? []) as unknown as VehicleRow[],
      fuelMonth: (fuelMonthResult.data ?? []) as unknown as { cost: number }[],
      maintenanceMonth: (maintenanceMonthResult.data ?? []) as unknown as { cost: number }[],
      recentFuel: (recentFuelResult.data ?? []) as unknown as FuelRow[],
      recentMaintenance: (recentMaintenanceResult.data ?? []) as unknown as MaintenanceRow[],
      alerts: (alertsResult.data ?? []) as unknown as AlertRow[],
      alertsOpen: alertsCountResult.count ?? 0,
      stockLow: stockRows.filter(
        (row) => Number(row.quantity_on_hand) < Number(row.min_quantity) && Number(row.min_quantity) > 0,
      ).length,
      reimbursementsOpen: reimbursementsResult.count ?? 0,
      franchiseCount: franchiseCountResult.count ?? 0,
    })
    setLoading(false)
  }, [profile, role])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const recentRecords = useMemo(() => {
    const fuel = data.recentFuel.map((row) => ({
      id: `fuel-${row.id}`,
      kind: 'fuel' as const,
      title: row.vehicle?.plate ? `Abastecimento · ${row.vehicle.plate}` : 'Abastecimento',
      subtitle: `${formatKm(row.odometer_km)} · ${formatDate(row.fueled_at)}`,
      amount: Number(row.cost),
      date: row.fueled_at,
    }))
    const maintenance = data.recentMaintenance.map((row) => ({
      id: `maint-${row.id}`,
      kind: 'maintenance' as const,
      title: row.vehicle?.plate
        ? `Manutenção · ${row.vehicle.plate}`
        : row.service_description,
      subtitle: `${row.service_description} · ${formatDate(row.performed_at)}`,
      amount: Number(row.cost),
      date: row.performed_at,
    }))

    return [...fuel, ...maintenance]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [data.recentFuel, data.recentMaintenance])

  if (!profile || !role) return null

  const firstName = profile.full_name.split(/\s+/)[0]
  const scope = profile.franchise ? `${profile.franchise.name}` : 'Toda a rede'
  const canRegister = role !== 'purchasing'

  const kpis: { icon: LucideIcon; label: string; value: string | number; hint: string }[] = []

  if (role === 'central_admin') {
    kpis.push({
      icon: Building2,
      label: 'Unidades ativas',
      value: data.franchiseCount,
      hint: 'franquias na rede',
    })
  }

  kpis.push({
    icon: Truck,
    label: role === 'agent' ? 'Meus veículos' : 'Veículos ativos',
    value: data.vehicles.length,
    hint: role === 'agent' ? 'sob sua posse' : 'na frota visível para você',
  })

  if (role === 'purchasing') {
    kpis.push({
      icon: PackageX,
      label: 'Itens abaixo do mínimo',
      value: data.stockLow,
      hint: 'precisam de reposição',
    })
    kpis.push({
      icon: ReceiptText,
      label: 'Reembolsos abertos',
      value: data.reimbursementsOpen,
      hint: 'aguardando aprovação',
    })
  } else {
    kpis.push({
      icon: Fuel,
      label: 'Combustível no mês',
      value: formatCurrency(sumCost(data.fuelMonth)),
      hint: role === 'agent' ? 'dos seus registros' : 'na unidade',
    })
    kpis.push({
      icon: Wrench,
      label: 'Manutenção no mês',
      value: formatCurrency(sumCost(data.maintenanceMonth)),
      hint: role === 'agent' ? 'dos seus registros' : 'na unidade',
    })
  }

  kpis.push({
    icon: Bell,
    label: 'Alertas abertos',
    value: data.alertsOpen,
    hint: 'pendentes de tratativa',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {greeting()}, {firstName}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{scope}</h2>
          <Badge variant="secondary">{ROLE_SCOPE[role]}</Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o painel</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} loading={loading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Veículos</CardTitle>
              <CardDescription>Quilometragem atual e agente de posse.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/vehicles">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((key) => (
                  <Skeleton key={key} className="h-14 w-full" />
                ))}
              </div>
            ) : data.vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <Truck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">Ainda não há veículos nesta unidade</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Cadastre a frota para começar a registrar abastecimentos e manutenções.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/vehicles">Ir para Veículos</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {data.vehicles.slice(0, 5).map((vehicle) => (
                  <li key={vehicle.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {vehicle.plate}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {vehicle.model ?? (vehicle.vehicle_type === 'motorcycle' ? 'Moto' : 'Carro')}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {vehicle.assignee?.full_name ?? 'Sem agente de posse'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatKm(vehicle.current_odometer_km)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Alertas recentes</CardTitle>
              <CardDescription>Manutenção, estoque e validade.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/alerts">Abrir</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-14 w-full" />
                ))}
              </div>
            ) : data.alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <Bell className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">Nenhum alerta no momento</p>
                <p className="text-xs text-muted-foreground">Tudo em dia por aqui.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.alerts.map((alert) => (
                  <li key={alert.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={alert.alert_type === 'maintenance_due' ? 'warning' : 'secondary'}>
                        {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Últimos registros</CardTitle>
            <CardDescription>Abastecimentos e manutenções mais recentes.</CardDescription>
          </div>
          {canRegister && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/fuel/new">Registrar</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-12 w-full" />
              ))}
            </div>
          ) : recentRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm font-medium">Ainda não há registros nesta unidade</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Abastecimentos e manutenções registrados no app ou pelo WhatsApp aparecem aqui.
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/vehicles">Ver veículos</Link>
                </Button>
                {canRegister && (
                  <Button size="sm" asChild>
                    <Link to="/fuel/new">Registrar abastecimento</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {recentRecords.map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {record.kind === 'fuel' ? (
                        <Fuel className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{record.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{record.subtitle}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatCurrency(record.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando indicadores…
        </p>
      )}
    </div>
  )
}
