
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
import { connectDatabase } from './db.js';

try {
  await connectDatabase();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'MediVault API is running',
      database:
        mongoose.connection.readyState === 1
          ? 'connected'
          : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  const server = createServer(app);

  server.on('error', (error) => {
    const alreadyRunning = error.code === 'EADDRINUSE';

    if (alreadyRunning) {
      console.warn(
        `MediVault API port ${config.PORT} is already in use.`
      );
    } else {
      console.error('MediVault API server error:', error.message);
    }

    mongoose.disconnect().finally(() => {
      process.exit(alreadyRunning ? 0 : 1);
    });
  });

  server.listen(config.PORT, () => {
    console.info(
      `MediVault API listening on port ${config.PORT}`
    );
  });

  const shutdown = async () => {
    server.close(async () => {
      try {
        await mongoose.disconnect();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('MediVault could not start:', error.message);
  process.exit(1);
}
