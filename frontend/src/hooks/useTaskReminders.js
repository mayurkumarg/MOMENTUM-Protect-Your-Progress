import { useEffect, useRef } from 'react'
import { taskApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/ToastProvider'

const CHECK_INTERVAL_MS = 30 * 1000
const REFRESH_INTERVAL_MS = 3 * 60 * 1000

// Mounted once at the app shell level so reminders fire no matter which page
// the user is on. Deliberately client-side: Momentum has no email/push
// backend, so a reminder is a toast + (if permitted) a browser Notification
// while the app is open — reliable for that scope, but it won't wake up a
// closed tab. See modules/task/task.model.js for how remindAt is computed.
export function useTaskReminders() {
  const auth = useAuth()
  const toast = useToast()
  const tasksRef = useRef([])
  const notifiedRef = useRef(new Set())

  useEffect(() => {
    if (!auth.isAuthenticated) return undefined

    let cancelled = false

    const loadTasks = async () => {
      try {
        const { tasks } = await taskApi.getTasks()
        if (!cancelled) tasksRef.current = tasks
      } catch {
        // reminders are a nicety, not core functionality — fail silently and retry next interval
      }
    }

    const checkReminders = async () => {
      const now = Date.now()

      for (const task of tasksRef.current) {
        const reminder = task.reminder
        if (!reminder?.enabled || !reminder.remindAt || reminder.notifiedAt) continue
        if (task.status === 'COMPLETED') continue
        if (notifiedRef.current.has(task.id)) continue
        if (new Date(reminder.remindAt).getTime() > now) continue

        notifiedRef.current.add(task.id)

        const dueLabel = task.deadline
          ? new Date(task.deadline).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })
          : null
        const body = dueLabel ? `Due ${dueLabel}` : 'Reminder'

        toast.info(`Reminder: "${task.title}" — ${body.toLowerCase()}.`)

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            // eslint-disable-next-line no-new
            new Notification('Momentum reminder', { body: `${task.title} — ${body}`, tag: task.id })
          } catch {
            // Notification constructor can throw in some browser contexts — the toast above already covers it
          }
        }

        taskApi.updateTask(task.id, { reminder: { ...reminder, notifiedAt: new Date().toISOString() } }).catch(() => {
          // best effort — if this fails the next reload may re-show the reminder once more, which is an
          // acceptable trade-off against silently losing it
        })
      }
    }

    loadTasks().then(checkReminders)
    const checkTimer = setInterval(checkReminders, CHECK_INTERVAL_MS)
    const refreshTimer = setInterval(loadTasks, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(checkTimer)
      clearInterval(refreshTimer)
    }
  }, [auth.isAuthenticated, toast])
}
