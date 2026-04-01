import { getApiKey, API_BASE_URL, WEB_BASE_URL } from '../config.js';

const SOURCE_HEADER = 'x-skillboss-source';
const SOURCE_VALUE = 'cli';
const AGENT_ID = process.env.SKILLBOSS_AGENT_ID || '';

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
  stream?: boolean;
}

/**
 * Resolve the API key: explicit --key flag > stored credentials > env var.
 * Exits with error if none found.
 */
export function resolveApiKey(keyOverride?: string): string {
  const key = keyOverride || getApiKey();
  if (!key) {
    console.error('\n  Error: Not authenticated. Run `skb login` or pass --key <key>\n');
    process.exit(1);
  }
  return key;
}

/**
 * Make an authenticated API request. Returns parsed JSON.
 * For streaming, use apiRequestRaw() instead.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {},
  keyOverride?: string,
): Promise<T> {
  const apiKey = resolveApiKey(keyOverride);
  const method = options.method || 'GET';

  let url = `${API_BASE_URL}${endpoint}`;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      [SOURCE_HEADER]: SOURCE_VALUE,
      ...(AGENT_ID && { 'x-agent-id': AGENT_ID }),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let message: string;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.detail || parsed.error?.message || parsed.message || errorBody;
    } catch {
      message = errorBody;
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

/**
 * Make an authenticated API request returning the raw Response.
 * Use for streaming (SSE) responses.
 */
export async function apiRequestRaw(
  endpoint: string,
  options: ApiRequestOptions = {},
  keyOverride?: string,
): Promise<Response> {
  const apiKey = resolveApiKey(keyOverride);
  const method = options.method || 'GET';

  let url = `${API_BASE_URL}${endpoint}`;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      [SOURCE_HEADER]: SOURCE_VALUE,
      ...(AGENT_ID && { 'x-agent-id': AGENT_ID }),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let message: string;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.detail || parsed.error?.message || parsed.message || errorBody;
    } catch {
      message = errorBody;
    }
    throw new ApiError(message, res.status);
  }

  return res;
}

/**
 * Make a request to the SkillBoss web app API.
 * Used for account endpoints like /api/me/balance.
 * Uses API_BASE_URL with /v1 stripped (same host, different path).
 */
export async function webRequest<T = unknown>(
  endpoint: string,
  keyOverride?: string,
): Promise<T> {
  const apiKey = resolveApiKey(keyOverride);
  const baseUrl = API_BASE_URL.replace('/v1', '');

  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...(AGENT_ID && { 'x-agent-id': AGENT_ID }),
    },
  });

  if (!res.ok) {
    throw new ApiError(`Request failed: ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Format ApiError into user-friendly messages.
 */
export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Invalid API key. Run `skb login` to re-authenticate.';
      case 402:
        return 'Insufficient credits. Add more at skillboss.co/console';
      case 429:
        return 'Rate limited. Please wait and try again.';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

/**
 * Check if an API response is an async job (202 Accepted).
 */
export function isAsyncJob(result: unknown): result is { status: 'accepted'; job_id: string; poll_url: string; model: string } {
  return (
    typeof result === 'object' && result !== null &&
    (result as Record<string, unknown>).status === 'accepted' &&
    typeof (result as Record<string, unknown>).job_id === 'string'
  );
}

/**
 * Poll an async job until it reaches a terminal state (completed/failed).
 * Returns the final result or throws on failure.
 */
export async function pollJob(
  jobId: string,
  keyOverride?: string,
  onStatus?: (status: string) => void,
  intervalMs = 5000,
  maxAttempts = 300,
): Promise<Record<string, unknown>> {
  const apiKey = resolveApiKey(keyOverride);

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${API_BASE_URL}/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        [SOURCE_HEADER]: SOURCE_VALUE,
        ...(AGENT_ID && { 'x-agent-id': AGENT_ID }),
      },
    });

    if (!res.ok) {
      throw new ApiError(`Failed to poll job: ${res.status}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const status = data.status as string;

    if (onStatus) { onStatus(status); }

    if (status === 'completed') {
      return data.result as Record<string, unknown>;
    }
    if (status === 'failed') {
      throw new ApiError((data.error as string) || 'Job failed', 500);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new ApiError('Job polling timed out', 504);
}
