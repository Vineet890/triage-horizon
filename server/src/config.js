import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from server/.env regardless of the cwd the process was started from.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

export const PORT = Number(process.env.PORT) || 5000;

// Mock mode by default. Set USE_LIVE_LLM=true in the environment to call the live LLM.
export const USE_LIVE_LLM = process.env.USE_LIVE_LLM === 'true';

export const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/triage-horizon';

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@triage-horizon.local';
