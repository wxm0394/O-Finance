/**
 * Unified API Client Abstraction for O-Finance v0.2
 * - Defaults to Mock Adapter in Demo Mode (`VITE_DEMO_MODE !== 'false'`).
 * - Ready to connect to a local Python FastAPI Backend (`http://127.0.0.1:8000`) when exported.
 * - Provides typed request/response envelopes and explicit error normalization.
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
  clientVersion: 'Desktop-Web-v0.2',
};

export async function simulateNetworkDelay<T>(data: T, ms = 150): Promise<T> {
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
    fallbackMock: () => T | Promise<T>,
    options?: RequestInit
  ): Promise<T> {
    if (this.isDemoMode) {
      const result = await fallbackMock();
      return simulateNetworkDelay(result, 140);
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
    fallbackMock: () => T | Promise<T>
  ): Promise<ApiResponseEnvelope<T>> {
    const data = await this.request<T>(endpoint, fallbackMock);
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
