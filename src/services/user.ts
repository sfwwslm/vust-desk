import type Database from "@tauri-apps/plugin-sql";
import { join } from "@tauri-apps/api/path";
import { readDir, remove } from "@tauri-apps/plugin-fs";
import * as log from "@tauri-apps/plugin-log";
import {
  ASSET_CATEGORIES_TABLE_NAME,
  ASSET_TABLE_NAME,
  SEARCH_ENGINES_TABLE_NAME,
  SYNC_METADATA_TABLE_NAME,
  USER_TABLE_NAME,
  WEBSITE_GROUPS_TABLE_NAME,
  WEBSITES_TABLE_NAME,
} from "@/constants";
import { getIconsDir } from "@/utils/fs";
import { dbClient, getDb } from "@/services/db";

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
      [ANONYMOUS_USER_UUID],
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
    [uuid],
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
  newUsername: string,
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
  isLoggedIn: boolean,
): Promise<void> {
  await dbClient.execute("UPDATE users SET is_logged_in = $1 WHERE uuid = $2", [
    isLoggedIn ? 1 : 0,
    uuid,
  ]);
}

/**
 * @function updateUserServerAddress
 * @description 更新指定用户的服务器地址。
 * @param {string} uuid - 用户的 UUID。
 * @param {string} serverAddress - 完整的服务器地址（包含协议）。
 */
export async function updateUserServerAddress(
  uuid: string,
  serverAddress: string,
): Promise<void> {
  await dbClient.execute(
    "UPDATE users SET server_address = $1 WHERE uuid = $2",
    [serverAddress, uuid],
  );
  log.info(`用户 ${uuid} 的服务器地址已更新为 ${serverAddress}`);
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
      "SELECT uuid, username, is_logged_in AS isLoggedIn, server_address AS serverAddress, server_instance_uuid AS serverInstanceUuid, token FROM users WHERE is_logged_in = 1",
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

/**
 * 删除本地数据库中未被任何记录引用的图标文件。
 * @returns {Promise<number>} 实际删除的文件数量。
 */
export async function cleanupUnusedIcons(): Promise<number> {
  try {
    const websiteIcons = await dbClient.select<{
      local_icon_path: string | null;
    }>(
      `SELECT DISTINCT local_icon_path FROM ${WEBSITES_TABLE_NAME} WHERE local_icon_path IS NOT NULL AND is_deleted = 0`,
    );
    const searchEngineIcons = await dbClient.select<{
      local_icon_path: string | null;
    }>(
      `SELECT DISTINCT local_icon_path FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE local_icon_path IS NOT NULL`,
    );

    const usedIconNames = new Set<string>();
    websiteIcons.forEach(
      (row) => row.local_icon_path && usedIconNames.add(row.local_icon_path),
    );
    searchEngineIcons.forEach(
      (row) => row.local_icon_path && usedIconNames.add(row.local_icon_path),
    );

    const iconsDir = await getIconsDir();
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(iconsDir);
    } catch (error) {
      log.warn(`读取图标目录失败，跳过图标清理: ${error}`);
      return 0;
    }

    let removed = 0;
    for (const entry of entries) {
      if (!entry.name || entry.isDirectory) continue;
      if (!usedIconNames.has(entry.name)) {
        const fullPath = await join(iconsDir, entry.name);
        try {
          await remove(fullPath);
          removed += 1;
        } catch (error) {
          log.error(`删除未引用图标失败: ${fullPath} | ${error}`);
        }
      }
    }

    if (removed === 0) {
      log.debug("没有需要清理的本地图标文件。");
    }
    return removed;
  } catch (error) {
    log.error(`清理未使用图标时出错: ${error}`);
    return 0;
  }
}

async function executeWithRetry(
  db: Database,
  sql: string,
  params: any[],
  retries = 5,
  delayMs = 300,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await db.execute(sql, params);
      return;
    } catch (error: any) {
      const message = error?.toString?.() || "";
      const isLocked = message.includes("database is locked");
      if (!isLocked || attempt === retries) {
        throw error instanceof Error ? error : new Error(String(error));
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

/**
 * 删除指定用户及其关联的本地数据（导航、资产、搜索引擎等），并清理冗余图标。
 * @param userUuid - 目标用户的 UUID。
 */
export async function deleteUserWithData(userUuid: string): Promise<void> {
  if (userUuid === ANONYMOUS_USER_UUID) {
    throw new Error("匿名用户用于离线数据，无法删除。");
  }

  const db = await getDb();
  try {
    // tauri plugin-sql 不支持事务，按依赖顺序逐条执行并重试应对锁
    const deletions = [
      `DELETE FROM ${WEBSITES_TABLE_NAME} WHERE user_uuid = $1`,
      `DELETE FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = $1`,
      `DELETE FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE user_uuid = $1`,
      `DELETE FROM ${ASSET_TABLE_NAME} WHERE user_uuid = $1`,
      `DELETE FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1`,
      `DELETE FROM ${SYNC_METADATA_TABLE_NAME} WHERE user_uuid = $1`,
    ];

    for (const sql of deletions) {
      await executeWithRetry(db, sql, [userUuid]);
    }

    let userResult;
    try {
      userResult = await db.execute(
        `DELETE FROM ${USER_TABLE_NAME} WHERE uuid = $1`,
        [userUuid],
      );
    } catch (error: any) {
      const message = error?.toString?.() || "";
      if (message.includes("database is locked")) {
        await executeWithRetry(
          db,
          `DELETE FROM ${USER_TABLE_NAME} WHERE uuid = $1`,
          [userUuid],
        );
        userResult = { rowsAffected: 1 };
      } else {
        throw error;
      }
    }

    if (!userResult || (userResult.rowsAffected || 0) === 0) {
      throw new Error("未找到要删除的用户，可能已被移除。");
    }

    log.info(`已删除用户 ${userUuid} 及其关联数据。`);
  } catch (error) {
    log.error(`删除用户 ${userUuid} 失败: ${error}`);
    throw error instanceof Error ? error : new Error(String(error));
  }

  const removedIcons = await cleanupUnusedIcons();
  if (removedIcons > 0) {
    log.info(`已清理 ${removedIcons} 个未引用的本地图标文件。`);
  }
}
