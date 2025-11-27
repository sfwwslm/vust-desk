/**
 * @file src/services/errors.ts
 * @description 定义应用中用于网络请求的自定义错误类。
 *
 * 提供针对不同场景的错误类型，使得调用方可以更精确地捕获和处理。
 * 所有 API 相关错误均继承自 ApiError。
 */

/**
 * API 请求错误的基类。
 */
export class ApiError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    // 修正原型链，确保 instanceof 正常工作
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }

  toString(): string {
    return (
      `${this.name}: ${this.message}` +
      (this.statusCode ? ` (status: ${this.statusCode})` : "")
    );
  }
}

/**
 * 网络连接失败（如 DNS 解析失败、无网络连接等）。
 */
export class NetworkError extends ApiError {
  public readonly originalError: Error;

  constructor(originalError: Error) {
    super(`网络请求失败: ${originalError.message}`);
    this.originalError = originalError;
  }
}

/**
 * 服务器返回非 2xx HTTP 状态码。
 */
export class HttpError extends ApiError {
  public readonly responseBody?: any;

  constructor(message: string, statusCode: number, responseBody?: any) {
    super(`HTTP 请求失败: ${message}`, statusCode);
    this.responseBody = responseBody;
  }

  override toString(): string {
    return `${super.toString()}${
      this.responseBody
        ? ` >>> 响应内容: ${JSON.stringify(this.responseBody)}`
        : this.responseBody
    }`;
  }
}

/**
 * 请求超时。
 */
export class TimeoutError extends ApiError {
  constructor(message = "请求超时") {
    super(message);
  }
}
