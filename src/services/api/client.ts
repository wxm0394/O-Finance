/**
 * Unified API Client Abstraction for O-Finance v0.3.1
 * - Operates in two explicit, non-overlapping modes:
 *   1. `DEMO` (`VITE_DEMO_MODE !== 'false'`): Uses local deterministic Demo Adapter. Never claims live LLM connectivity or verified API keys.
 *   2. `LOCAL_FASTAPI` (`VITE_DEMO_MODE === 'false'`): Connects to the local Python FastAPI + Pydantic AI + Gemini backend (`http://127.0.0.1:8000`).
 */

export type BackendRuntimeMode = 'DEMO' | 'LOCAL_FASTAPI';

export interface ApiClientConfig {
  demoMode: boolean;
  runtimeMode: BackendRuntimeMode;
  baseUrl: string;
  clientVersion: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  endpoint: string;
  status: number;
  timestamp: string;
  isSimulated: boolean;
}

export interface ApiResponseEnvelope<T> {
  data: T;
  meta: {
    mode: BackendRuntimeMode;
    endpoint: string;
    timestamp: string;
    deterministicMath: boolean;
  };
}

const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env
    : typeof process !== 'undefined' && process.env
    ? process.env
    : {};

export function getRuntimeModeFromStorage(): BackendRuntimeMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('ofinance_runtime_mode');
    if (stored === 'demo') return 'DEMO';
    if (stored === 'live') return 'LOCAL_FASTAPI';
  }
  const isDemo = env.VITE_DEMO_MODE !== 'false';
  return isDemo ? 'DEMO' : 'LOCAL_FASTAPI';
}

export function setRuntimeModeInStorage(mode: 'demo' | 'live'): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('ofinance_runtime_mode', mode);
  }
}

/**
 * Normalizes the API Base URL so that both `http://127.0.0.1:8000` and `http://127.0.0.1:8000/api/v1`
 * resolve without double-prefixing `/api/v1/api/v1`.
 */
export function resolveEndpointUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.trim().replace(/^\/+/, '');

  if (cleanBase.endsWith('/api/v1') && cleanEndpoint.startsWith('api/v1/')) {
    return `${cleanBase}/${cleanEndpoint.slice('api/v1/'.length)}`;
  }
  return `${cleanBase}/${cleanEndpoint}`;
}

export const apiClientConfig: ApiClientConfig = {
  get demoMode() {
    return getRuntimeModeFromStorage() === 'DEMO';
  },
  get runtimeMode() {
    return getRuntimeModeFromStorage();
  },
  baseUrl: (env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, ''),
  clientVersion: 'Desktop-Web-v0.4.0',
};

export async function simulateNetworkDelay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), ms);
  });
}

export class ApiClient {
  static get isDemoMode(): boolean {
    return apiClientConfig.demoMode;
  }

  static get runtimeMode(): BackendRuntimeMode {
    return apiClientConfig.runtimeMode;
  }

  static get baseUrl(): string {
    return apiClientConfig.baseUrl;
  }

  static async request<T>(
    endpoint: string,
    fallbackDemoAdapter: () => T | Promise<T>,
    options?: RequestInit
  ): Promise<T> {
    if (this.isDemoMode) {
      const result = await fallbackDemoAdapter();
      return simulateNetworkDelay(result, 120);
    }

    const fullUrl = resolveEndpointUrl(this.baseUrl, endpoint);

    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-OFinance-Client': apiClientConfig.clientVersion,
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const errorPayload: ApiErrorPayload = {
        code: `HTTP_${res.status}`,
        message: `FastAPI Error [${res.status}] on ${endpoint}`,
        endpoint,
        status: res.status,
        timestamp: new Date().toISOString(),
        isSimulated: false,
      };
      throw new Error(errorPayload.message);
    }

    return res.json() as Promise<T>;
  }

  static async requestEnvelope<T>(
    endpoint: string,
    fallbackDemoAdapter: () => T | Promise<T>,
    options?: RequestInit
  ): Promise<ApiResponseEnvelope<T>> {
    const data = await this.request<T>(endpoint, fallbackDemoAdapter, options);
    return {
      data,
      meta: {
        mode: this.runtimeMode,
        endpoint,
        timestamp: new Date().toISOString(),
        deterministicMath: true,
      },
    };
  }
}
