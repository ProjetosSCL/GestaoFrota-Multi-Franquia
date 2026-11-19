import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth, RequireRole } from '@/components/route-guards'
import { AppLayout } from '@/layouts/AppLayout'
import { ComingSoonPage } from '@/pages/ComingSoon'
import { DashboardPage } from '@/pages/Dashboard'
import { LoginPage } from '@/pages/Login'
import { NotFoundPage } from '@/pages/NotFound'
import { UnauthorizedPage } from '@/pages/Unauthorized'

const MANAGEMENT = ['central_admin', 'franchise_manager'] as const
const OPERATIONS = ['central_admin', 'franchise_manager', 'agent'] as const

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/vehicles" element={<ComingSoonPage />} />
          <Route path="/inventory" element={<ComingSoonPage />} />
          <Route path="/alerts" element={<ComingSoonPage />} />
          <Route path="/settings" element={<ComingSoonPage />} />

          <Route element={<RequireRole allowed={[...OPERATIONS]} />}>
            <Route path="/fuel/new" element={<ComingSoonPage />} />
            <Route path="/maintenance/new" element={<ComingSoonPage />} />
            <Route path="/inventory/withdraw" element={<ComingSoonPage />} />
          </Route>

          <Route element={<RequireRole allowed={[...MANAGEMENT]} />}>
            <Route path="/maintenance-rules" element={<ComingSoonPage />} />
            <Route path="/reports" element={<ComingSoonPage />} />
            <Route path="/users" element={<ComingSoonPage />} />
          </Route>

          <Route element={<RequireRole allowed={['central_admin', 'franchise_manager', 'purchasing']} />}>
            <Route path="/inventory/entry" element={<ComingSoonPage />} />
            <Route path="/reimbursements" element={<ComingSoonPage />} />
          </Route>

          <Route element={<RequireRole allowed={['central_admin']} />}>
            <Route path="/inventory/item-types" element={<ComingSoonPage />} />
            <Route path="/franchises" element={<ComingSoonPage />} />
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
