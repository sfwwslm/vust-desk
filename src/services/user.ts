import { dbClient } from "@/services/db";
import * as log from "@tauri-apps/plugin-log";

/** 用户表的数据结构 */
export interface User {
  uuid: string;
  username: string;
  isLoggedIn: number;
  /** 用户登录时使用的服务器地址，用于后续数据同步 */
  serverAddress?: string;
  /** 服务器实例的唯一ID，用于区分不同服务器上的同名账户 */
  serverInstanceUuid?: string;
  /**
   * 登录成功后获取的访问令牌。
   */
  token?: string;
}

/**
 * 匿名（未登录）用户的硬编码 UUID。
 * 所有离线创建的数据都将关联到此用户，直到被认领。
 */
export const ANONYMOUS_USER_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * 匿名（未登录）用户的硬编码用户名。
 * 所有离线创建的数据都将关联到此用户，直到被认领。
 */
export const ANONYMOUS_USER = "anonymous";

/**
 * @function getAnonymousUserUuid
 * @description 从数据库中检索匿名用户的UUID。
 * @returns {Promise<string | null>} 如果找到，则返回匿名用户的UUID，否则返回null。
 */
export const getAnonymousUserUuid = async (): Promise<string | null> => {
  try {
    const users = await dbClient.select<{ uuid: string }>(
      "SELECT uuid FROM users WHERE uuid = $1",
      [ANONYMOUS_USER_UUID]
    );
    const firstUser = users[0];
    return firstUser ? firstUser.uuid : null;
  } catch (error) {
    log.error(`获取匿名用户UUID失败: ${error}`);
    return null;
  }
};

/**
 * 根据用户 UUID 获取用户名
 * @param uuid
 * @returns
 */
export async function getUsernameByUuid(uuid: string): Promise<string | null> {
  const users = await dbClient.select<User>(
    "SELECT username FROM users WHERE uuid = $1",
    [uuid]
  );
  if (users.length > 0) {
    return users[0].username;
  }
  return null;
}

/**
 * @function updateUsername
 * @description 更新指定用户的用户名。
 * @param {string} uuid - 用户的 UUID。
 * @param {string} newUsername - 新的用户名。
 */
export async function updateUsername(
  uuid: string,
  newUsername: string
): Promise<void> {
  await dbClient.execute("UPDATE users SET username = $1 WHERE uuid = $2", [
    newUsername,
    uuid,
  ]);
  log.info(`用户 ${uuid} 的用户名已更新为 ${newUsername}`);
}

/**
 * @function setUserLoginStatus
 * @description 设置用户的登录状态。
 * @param {string} uuid - 用户的 UUID。
 * @param {boolean} isLoggedIn - 新的登录状态。
 */
export async function setUserLoginStatus(
  uuid: string,
  isLoggedIn: boolean
): Promise<void> {
  await dbClient.execute("UPDATE users SET is_logged_in = $1 WHERE uuid = $2", [
    isLoggedIn ? 1 : 0,
    uuid,
  ]);
}

/**
 * @function getAllUsers
 * @description 获取所有登录状态的用户，用于切换的用户。
 * @description 注意字段的重命名
 * @returns {Promise<User[]>} 返回可切换的用户列表。
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const users = await dbClient.select<User>(
      "SELECT uuid, username, is_logged_in AS isLoggedIn, server_address AS serverAddress, server_instance_uuid AS serverInstanceUuid, token FROM users WHERE is_logged_in = 1"
    );
    return users;
  } catch (error) {
    log.error(`获取可切换用户列表失败: ${error}`);
    return [];
  }
};

/**
 * 从 localStorage 直接读取并解析当前激活的用户数据。
 * 这使得在 React 组件之外（如 API客户端）也能安全地获取用户信息。
 * @returns {User | null} 解析后的用户对象，如果未找到或格式不正确则返回 null。
 */
export const getActiveUserFromStorage = (): User | null => {
  try {
    const item = window.localStorage.getItem("activeUser");
    if (!item) {
      return null;
    }

    const parsedUser: User = JSON.parse(item);

    // 进行基本验证，确保解析出的对象包含关键字段
    if (parsedUser && typeof parsedUser === "object" && parsedUser.uuid) {
      return parsedUser;
    }

    return null;
  } catch (error) {
    log.error(`从 localStorage 读取或解析 activeUser 失败: ${error}`);
    return null;
  }
};
