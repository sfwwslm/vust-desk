/**
 * @file src/services/apiClient.ts
 * @description 封装了一个健壮的、支持超时的 fetch API 客户端。
 *
 * 这个客户端旨在统一应用中所有的 HTTP 请求，提供了以下核心功能：
 * 1.  **动态 Base URL**：在每次请求时，从 localStorage 动态获取服务器地址。
 * 2.  **自动认证**：自动从 localStorage 读取并注入 Bearer Token。
 * 3.  **请求超时处理**：使用 `AbortController` 实现可靠的请求超时。
 * 4.  **精细的错误处理**：将不同类型的错误封装成自定义错误类，便于上层捕获和处理。
 * 5.  **响应体自动解析**：根据响应头的 'Content-Type' 自动解析 JSON。
 * 6.  **便捷的 HTTP 方法**：提供了 `get`, `post`, `put`, `delete` 等快捷方法。
 */

import { fetch } from "@tauri-apps/plugin-http";
import { getActiveUserFromStorage, ANONYMOUS_USER_UUID } from "./user";
import { ApiError, NetworkError, HttpError, TimeoutError } from "./errors";
import { saveUser } from "./db";
import * as log from "@tauri-apps/plugin-log";

// --- 类型定义 ---

/**
 * @interface RequestOptions
 * @description 定义了 apiClient 函数的配置选项。
 */
interface RequestOptions extends RequestInit {
  /**
   * 请求的超时时间（毫秒）。
   * @default 8000
   */
  timeout?: number;
  /**
   * 请求体，可以是任何可以被序列化为 JSON 的对象。
   */
  body?: any;
  /**
   * 可选的基础 URL (协议 + 主机名 + 端口)。
   * 如果提供，则请求将发往此地址；否则，将使用当前登录用户的 `serverAddress` 作为默认值。
   * @example "https://api.github.com"
   */
  baseUrl?: string;

  [key: string]: any;
}

// --- 核心实现 ---

/**
 * 刷新令牌的内部函数
 */
async function refreshAccessToken(activeUser: any): Promise<string> {
  const refreshUrl = `${activeUser.serverAddress}/api/refresh`;
  log.info(`正在尝试为用户 ${activeUser.username} 刷新 Access Token...`);
  
  const response = await fetch(refreshUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: activeUser.refreshToken }),
    danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
  });

  if (!response.ok) {
    log.error(`用户 ${activeUser.username} 的令牌刷新请求失败: ${response.status}`);
    throw new ApiError("会话已过期，请重新登录。", 401);
  }

  const data = await response.json();
  const newUser = {
    ...activeUser,
    token: data.accessToken,
    refreshToken: data.refreshToken,
  };

  // 更新本地数据库
  await saveUser(newUser);
  // 更新 localStorage 以便后续请求使用新令牌
  window.localStorage.setItem("activeUser", JSON.stringify(newUser));

  log.info(`用户 ${activeUser.username} 的 Access Token 刷新成功。`);
  return data.accessToken;
}

/**
 * 一个健壮的 fetch 封装，它在每次调用时动态读取认证信息。
 *
 * @template T - 期望的响应数据类型。
 * @param {string} endpoint - API 的端点路径 (e.g., '/api/v1/profile')。
 * @param {RequestOptions} [options={}] - fetch 请求的配置选项。
 * @param {boolean} [isRetry=false] - 是否为重试请求。
 * @returns {Promise<T>} - 解析后的响应数据。
 * @throws {ApiError} 如果用户未登录或认证信息不完整。
 * @throws {TimeoutError} 如果请求超时。
 * @throws {HttpError} 如果服务器返回非 2xx 状态码。
 * @throws {NetworkError} 如果发生网络层面的错误。
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  // 在请求发起前，从 localStorage 动态获取当前用户信息
  const activeUser = getActiveUserFromStorage();

  if (
    activeUser?.uuid !== ANONYMOUS_USER_UUID &&
    (!activeUser?.serverAddress || !activeUser?.token)
  ) {
    throw new ApiError("无法发起请求：用户未登录或认证信息不完整。", 401);
  }

  // 1. 设置超时逻辑
  const { timeout = 8000, baseUrl, ...restOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 2. 准备请求头
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization") && activeUser?.token) {
    headers.set("Authorization", `Bearer ${activeUser.token}`);
  }

  // 3. 准备请求体
  const body = options.body ? JSON.stringify(options.body) : undefined;

  // 4. 构建完整的请求 URL
  const serverAddress = baseUrl || activeUser.serverAddress;
  const requestUrl = `${serverAddress}${endpoint}`;

  try {
    // 5. 发起 fetch 请求
    const response = await fetch(requestUrl, {
      ...restOptions,
      headers,
      body,
      signal: controller.signal,
      danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true },
    });

    clearTimeout(timeoutId);

    // 6. 检查 HTTP 响应状态
    if (!response.ok) {
      // 如果是 401 错误且不是重试请求，尝试刷新令牌
      if (response.status === 401 && !isRetry && activeUser?.refreshToken) {
        log.info("检测到 401 错误，尝试刷新令牌...");
        try {
          await refreshAccessToken(activeUser);
          // 重新发起请求
          return await apiClient(endpoint, options, true);
        } catch (refreshError) {
          log.error(`令牌刷新失败: ${refreshError}`);
          // 刷新失败，继续执行后面的错误抛出逻辑
        }
      }

      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new HttpError(
        `服务器响应错误: ${response.statusText}`,
        response.status,
        errorBody,
      );
    }

    // 7. 解析成功的响应体
    const contentType = response.headers.get("content-type");
    if (response.status === 204 || !contentType) {
      // 204 No Content
      return null as T;
    }
    if (contentType?.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error) {
    clearTimeout(timeoutId);

    // 8. 错误分类与处理
    if (error instanceof ApiError || error instanceof HttpError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError(`请求 '${endpoint}' 已超时 (${timeout}ms)`);
    }
    if (error instanceof TypeError) {
      throw new NetworkError(error);
    }
    log.error(`请求 '${endpoint}' 发生错误: ${error}`);
    // 匹配括号及其中内容，并删除首尾空格
    const result = (error as string).replace(/\([^)]*\)/g, "").trim();
    throw new ApiError(error instanceof Error ? error.message : result);
  }
}

/**
 * apiClient 的便捷方法集合，简化常用 HTTP 请求的调用。
 */
export const apiClientWrapper = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body: any, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body: any, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: "PUT", body }),

  delete: <T>(endpoint: string, body: any, options?: RequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: "DELETE", body }),
};
