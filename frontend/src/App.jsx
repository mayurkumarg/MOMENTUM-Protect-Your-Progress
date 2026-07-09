import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Activity from './pages/Activity'
import Analytics from './pages/Analytics'
import Assistant from './pages/Assistant'
import GitHubActivity from './pages/GitHubActivity'
import HelpFeedback from './pages/HelpFeedback'
import ProtectedRoute, { LoginRoute } from './auth/ProtectedRoute'
import Install from './pages/Install'
import Overview from './pages/Overview'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'
import Login from './pages/Login'
import Register from './pages/Register'
import GitHubCallback from './pages/GitHubCallback'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute><Login /></LoginRoute>} />
      <Route path="/register" element={<LoginRoute><Register /></LoginRoute>} />
      <Route path="/install" element={<Install />} />
      <Route path="/auth/github/callback" element={<GitHubCallback />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/activity" element={<Activity />} />
          {/* Timeline's unified tasks+activity view moved into Activity — redirect old links/bookmarks there. */}
          <Route path="/timeline" element={<Navigate to="/activity" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/github" element={<GitHubActivity />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<HelpFeedback />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
