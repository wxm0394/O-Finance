/**
 * Unified API Client Abstraction for O-Finance
 * Defaults to Mock Adapter in Demo Mode (`VITE_DEMO_MODE !== 'false'`).
 * Ready to connect to Python FastAPI Backend (`http://127.0.0.1:8000`) when exported locally.
 */

export interface ApiClientConfig {
  demoMode: boolean;
  baseUrl: string;
}

export const apiClientConfig: ApiClientConfig = {
  demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
};

export async function simulateNetworkDelay<T>(data: T, ms = 180): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), ms);
  });
}

export class ApiClient {
  static get isDemoMode(): boolean {
    return apiClientConfig.demoMode;
  }

  static get baseUrl(): string {
    return apiClientConfig.baseUrl;
  }

  static async request<T>(endpoint: string, fallbackMock: () => T | Promise<T>): Promise<T> {
    if (this.isDemoMode) {
      const result = await fallbackMock();
      return simulateNetworkDelay(result, 150);
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-OFinance-Client': 'Desktop-Web-v0.1',
      },
    });
    if (!res.ok) {
      throw new Error(`FastAPI Error [${res.status}] on ${endpoint}`);
    }
    return res.json() as Promise<T>;
  }
}
