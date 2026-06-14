const express = require('express');
const cors = require('cors');
const errorMiddleware = require('./middlewares/errorMiddleware');
require('./config/env');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/tasks', require('./modules/task/task.routes'));
app.use('/api/activities', require('./modules/activity/activity.routes'));
app.use('/api/dsa', require('./modules/activity/dsa-activity.routes'));

app.use(errorMiddleware);

module.exports = app;
