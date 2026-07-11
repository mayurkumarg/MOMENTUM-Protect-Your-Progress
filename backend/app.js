const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorMiddleware = require('./middlewares/errorMiddleware');
require('./config/env');

const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// Behind a production reverse proxy/load balancer, this makes req.ip (used
// by rate limiting) reflect the real client IP instead of the proxy's own.
if (isProduction) {
  app.set('trust proxy', 1);
}

// contentSecurityPolicy is off because this is a pure JSON/file API, not an
// HTML app — CSP has nothing to protect here. crossOriginResourcePolicy is
// relaxed because the API is deliberately called cross-origin by design (the
// separately-hosted frontend, the browser extension, and note-attachment
// downloads) — the stricter default would silently break those.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...(isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/github', require('./modules/github/github.routes'));
app.use('/api/tasks', require('./modules/task/task.routes'));
app.use('/api/activities', require('./modules/activity/activity.routes'));
app.use('/api/dsa', require('./modules/activity/dsa-activity.routes'));
app.use('/api/workload', require('./modules/workload/workload.routes'));
app.use('/api/analytics', require('./modules/analytics/analytics.routes'));
app.use('/api/assistant', require('./modules/assistant/assistant.routes'));
app.use('/api/notes', require('./modules/notes/notes.routes'));
app.use('/api/companies', require('./modules/companies/company.routes'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

app.use(errorMiddleware);

module.exports = app;
