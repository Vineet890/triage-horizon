import mongoose from 'mongoose';
import { MONGODB_URI } from '../config.js';

/**
 * Opens the MongoDB connection.
 *
 * Throws when the server is unreachable so callers can abort startup instead
 * of serving traffic against a half-initialised database.
 */
export async function connectDB() {
  try {
    mongoose.set('strictQuery', true);

    const connection = await mongoose.connect(MONGODB_URI, {
      // Fail fast instead of hanging for the 30s driver default.
      serverSelectionTimeoutMS: 10000,
    });

    const { host, port, name } = connection.connection;
    console.log(`[db] MongoDB connected: ${host}:${port}/${name}`);

    return connection.connection;
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

export default connectDB;
