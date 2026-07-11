const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { validateEnv } = require('./config/env');
const { startSyncScheduler } = require('./modules/github/sync/scheduler');

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();
    startSyncScheduler();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('Server and database connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
