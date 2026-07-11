// Backend half of the reminder system — email dispatch only. The in-app
// channel stays entirely client-side (frontend/src/hooks/useTaskReminders.js)
// and this scheduler never touches it: each reminder tracks emailSentAt
// completely separately from notifiedAt (the in-app flag), so the two
// channels can never race each other into suppressing one another.
//
// Same lightweight pattern as modules/github/sync/scheduler.js — no external
// queue infra, an in-process interval that runs once at boot (catches
// anything that became due while the server was offline) and then
// periodically. A reminder only counts as "sent" after a successful send, so
// a transient failure (Mailtrap down, etc.) just leaves it eligible for the
// next tick — that's the whole "missed reminders" story, no separate retry
// mechanism needed.

const Task = require('../task/task.model');
const Company = require('../companies/company.model');
const User = require('../user/user.model');
const emailService = require('./email.service');
const { buildTaskReminderEmail, buildPlacementEventReminderEmail } = require('./reminderEmail.templates');

const INTERVAL_MS = 60 * 1000;
// A reminder older than this when we finally get to it (server was down for
// a while, etc.) is marked as handled without sending — a day-old "reminder"
// email is confusing, not useful.
const MAX_REMINDER_AGE_MS = 24 * 60 * 60 * 1000;

let timer = null;

const userChannelAllowsEmail = (user) => {
  if (!user || !user.email) return false;
  const channel = user.notificationPreferences?.reminderChannel;
  return channel === 'EMAIL' || channel === 'BOTH';
};

const isTooStale = (remindAt, now) => now.getTime() - new Date(remindAt).getTime() > MAX_REMINDER_AGE_MS;

async function dispatchTaskReminders(now) {
  const dueTasks = await Task.find({
    'reminder.enabled': true,
    'reminder.remindAt': { $lte: now },
    'reminder.emailSentAt': null,
    status: { $ne: 'COMPLETED' },
  });

  for (const task of dueTasks) {
    const shouldSend = !isTooStale(task.reminder.remindAt, now);
    const user = shouldSend ? await User.findById(task.userId) : null;

    if (!shouldSend || !userChannelAllowsEmail(user)) {
      task.reminder.emailSentAt = now;
      await task.save().catch((error) => console.error(`[reminders] failed to mark task ${task._id}:`, error.message));
      continue;
    }

    try {
      const { subject, html, text } = buildTaskReminderEmail(task);
      await emailService.sendEmail({ to: user.email, subject, html, text, category: 'task-reminder' });
      task.reminder.emailSentAt = now;
      await task.save();
    } catch (error) {
      console.error(`[reminders] failed to email task reminder ${task._id}:`, error.message);
      // emailSentAt stays null — retried next tick
    }
  }
}

async function dispatchPlacementEventReminders(now) {
  const dueCompanies = await Company.find({
    'importantDates.reminder.enabled': true,
    'importantDates.reminder.remindAt': { $lte: now },
    'importantDates.reminder.emailSentAt': null,
  });

  for (const company of dueCompanies) {
    let user = null;
    let userLoaded = false;

    for (const event of company.importantDates) {
      const reminder = event.reminder;
      if (!reminder?.enabled || !reminder.remindAt || reminder.emailSentAt) continue;
      if (new Date(reminder.remindAt).getTime() > now.getTime()) continue;

      const shouldSend = !isTooStale(reminder.remindAt, now);

      if (shouldSend && !userLoaded) {
        user = await User.findById(company.userId);
        userLoaded = true;
      }

      if (!shouldSend || !userChannelAllowsEmail(user)) {
        reminder.emailSentAt = now;
        continue;
      }

      try {
        const { subject, html, text } = buildPlacementEventReminderEmail({ company, event });
        await emailService.sendEmail({ to: user.email, subject, html, text, category: 'placement-reminder' });
        reminder.emailSentAt = now;
      } catch (error) {
        console.error(`[reminders] failed to email placement event ${company._id}/${event._id}:`, error.message);
      }
    }

    if (company.isModified()) {
      await company.save().catch((error) => console.error(`[reminders] failed to save company ${company._id}:`, error.message));
    }
  }
}

const runReminderSweep = async () => {
  if (!emailService.isConfigured()) return;

  const now = new Date();
  await dispatchTaskReminders(now).catch((error) => console.error('[reminders] task sweep failed:', error.message));
  await dispatchPlacementEventReminders(now).catch((error) => console.error('[reminders] placement sweep failed:', error.message));
};

const startReminderScheduler = () => {
  if (timer) return;

  runReminderSweep().catch(() => {});

  timer = setInterval(() => {
    runReminderSweep().catch(() => {});
  }, INTERVAL_MS);

  timer.unref?.();
};

module.exports = {
  startReminderScheduler,
  runReminderSweep,
};
