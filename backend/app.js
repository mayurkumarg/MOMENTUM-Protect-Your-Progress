const express = require('express');
const cors = require('cors');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/tasks', require('./modules/task/task.routes'));
app.use('/api/activities', require('./modules/activity/activity.routes'));

app.use(errorMiddleware);

module.exports = app;
