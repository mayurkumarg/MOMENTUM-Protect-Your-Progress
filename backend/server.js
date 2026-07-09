const app = require('./app');
const connectDB = require('./config/db');
const { validateEnv } = require('./config/env');
const { startSyncScheduler } = require('./modules/github/sync/scheduler');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();
    startSyncScheduler();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
