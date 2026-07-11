// Email bodies for the two reminder sources (Task, placement-event). Kept
// separate from email.service.js (the transport) so adding a third source
// later is a new build* function here, not a change to how sending works.

const getFrontendUrl = () => (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Task titles, company names, and event labels are free user text — escape
// before interpolating into HTML so a title like "<script>" or "Tom & Jerry
// interview" can't break the email markup.
const escapeHtml = (value) =>
  String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const wrapEmail = ({ heading, bodyHtml, ctaLabel, ctaUrl }) => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f5f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#182420;padding:20px 24px;">
                <span style="color:#F6B93B;font-weight:700;font-size:16px;letter-spacing:-0.01em;">Momentum</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 14px;font-size:18px;line-height:1.4;color:#111827;">${heading}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px;">
                <a href="${ctaUrl}" style="display:inline-block;background:#182420;color:#F6B93B;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#6b7280;">You're receiving this because reminders are set to email (or both) in Momentum Settings.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const buildTaskReminderEmail = (task) => {
  const url = `${getFrontendUrl()}/tasks/${task.id || task._id}/workspace`;
  const priorityLabel = PRIORITY_LABEL[task.priority] || task.priority;

  const bodyHtml = `
    <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(task.title)}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Due: ${formatDateTime(task.deadline)}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Priority: ${escapeHtml(priorityLabel)}</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Reminder set for: ${formatDateTime(task.reminder?.remindAt)}</p>
  `;

  return {
    subject: `Reminder: ${task.title}`,
    html: wrapEmail({ heading: 'Task reminder', bodyHtml, ctaLabel: 'Open in Momentum', ctaUrl: url }),
    text: `Task reminder: ${task.title}\nDue: ${formatDateTime(task.deadline)}\nPriority: ${priorityLabel}\nReminder set for: ${formatDateTime(task.reminder?.remindAt)}\n\nOpen in Momentum: ${url}`,
  };
};

const buildPlacementEventReminderEmail = ({ company, event }) => {
  const url = `${getFrontendUrl()}/placements/${company.id || company._id}`;

  const bodyHtml = `
    <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(event.label)} — ${escapeHtml(company.name)}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">When: ${formatDateTime(event.date)}</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Reminder set for: ${formatDateTime(event.reminder?.remindAt)}</p>
  `;

  return {
    subject: `Reminder: ${event.label} — ${company.name}`,
    html: wrapEmail({ heading: 'Upcoming placement event', bodyHtml, ctaLabel: 'Open in Momentum', ctaUrl: url }),
    text: `Upcoming placement event: ${event.label} — ${company.name}\nWhen: ${formatDateTime(event.date)}\nReminder set for: ${formatDateTime(event.reminder?.remindAt)}\n\nOpen in Momentum: ${url}`,
  };
};

module.exports = {
  buildTaskReminderEmail,
  buildPlacementEventReminderEmail,
};
