import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
PORT: z.coerce.number().int().positive().default(4000),
APP_ORIGIN: z.string().url().default('http://localhost:5173'),
APP_ALLOWED_ORIGINS: z.string().optional(),
MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
STORAGE_ENCRYPTION_KEY: z
.string()
.regex(/^[a-fA-F0-9]{64}$/, 'STORAGE_ENCRYPTION_KEY must be 64 hex characters'),
STORAGE_PATH: z.string().default('./storage'),
SMTP_HOST: z.string().optional(),
SMTP_PORT: z.coerce.number().default(587),
SMTP_SECURE: z.string().default('false'),
SMTP_USER: z.string().optional(),
SMTP_PASS: z.string().optional(),
SMTP_FROM: z.string().default('MediVault [no-reply@example.com](mailto:no-reply@example.com)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
console.error(
'Invalid environment configuration:',
parsed.error.issues.map((issue) => issue.message).join('; ')
);
process.exit(1);
}

const configuredOrigins = [
parsed.data.APP_ORIGIN,
...(parsed.data.APP_ALLOWED_ORIGINS || '')
.split(',')
.map((origin) => origin.trim())
.filter(Boolean),
];
const invalidOrigin = configuredOrigins.find((origin) => {
try {
const url = new URL(origin);
return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
} catch {
return true;
}
});
if (invalidOrigin) {
console.error('Invalid APP_ALLOWED_ORIGINS entry. Use comma-separated origins without paths.');
process.exit(1);
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const storagePath = path.resolve(dirname, '..', parsed.data.STORAGE_PATH);

const mailConfigured = Boolean(
parsed.data.SMTP_HOST &&
parsed.data.SMTP_USER &&
parsed.data.SMTP_PASS
);

export const config = {
...parsed.data,
allowedOrigins: [...new Set(configuredOrigins)],
storagePath,
mailConfigured,
production: parsed.data.NODE_ENV === 'production',
cookieName: 'mv_session',
};
