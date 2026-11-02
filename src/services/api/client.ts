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

const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false';

export const apiClientConfig: ApiClientConfig = {
  demoMode: isDemo,
  runtimeMode: isDemo ? 'DEMO' : 'LOCAL_FASTAPI',
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  clientVersion: 'Desktop-Web-v0.3.1',
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

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
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
