import type { ApiResponse, AuthSession } from "@pharmacy-os/types";
import axios from "axios";


export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

export const setAccessToken = (token: string | null): void => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("pharmacy-os-access-token", token);
    return;
  }
  delete api.defaults.headers.common.Authorization;
  localStorage.removeItem("pharmacy-os-access-token");
};

const savedToken = localStorage.getItem("pharmacy-os-access-token");
if (savedToken) {
  setAccessToken(savedToken);
}

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config && !error.config.headers?.["x-refresh-attempt"]) {
      refreshPromise ??= api
        .post<ApiResponse<{ accessToken: string }>>("/auth/refresh", {}, { headers: { "x-refresh-attempt": "true" } })
        .then((response) => {
          const token = response.data.data.accessToken;
          setAccessToken(token);
          return token;
        })
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });

      const token = await refreshPromise;
      if (token) {
        error.config.headers.Authorization = `Bearer ${token}`;
        error.config.headers["x-refresh-attempt"] = "true";
        return api(error.config);
      }
    }
    throw error;
  }
);

export const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> => {
  const response = await promise;
  return response.data.data;
};

export const loginRequest = async (email: string, password: string): Promise<AuthSession> =>
  unwrap(api.post<ApiResponse<AuthSession>>("/auth/login", { email, password, rememberMe: true }));
