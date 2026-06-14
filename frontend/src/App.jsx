import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Activity from './pages/Activity'
import Analytics from './pages/Analytics'
import Assistant from './pages/Assistant'
import ProtectedRoute, { LoginRoute } from './auth/ProtectedRoute'
import Overview from './pages/Overview'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'
import Timeline from './pages/Timeline'
import Login from './pages/Login'
import Register from './pages/Register'
import GitHubCallback from './pages/GitHubCallback'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute><Login /></LoginRoute>} />
      <Route path="/register" element={<LoginRoute><Register /></LoginRoute>} />
      <Route path="/auth/github/callback" element={<GitHubCallback />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
