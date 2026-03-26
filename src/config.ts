import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.config', 'skillboss');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');

export const API_BASE_URL = process.env.SKILLBOSS_API_URL || 'https://api.heybossai.com/v1';
export const WEB_BASE_URL = 'https://www.skillboss.co';

interface Credentials {
  apiKey: string;
  email?: string;
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) {
    // Check environment variable as fallback
    const envKey = process.env.SKILLBOSS_API_KEY;
    if (envKey) {
      return { apiKey: envKey };
    }
    return null;
  }

  try {
    const content = readFileSync(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir();
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE);
  }
}

export function getApiKey(): string | null {
  const creds = getCredentials();
  return creds?.apiKey ?? null;
}
