import Database, { QueryResult } from "@tauri-apps/plugin-sql";
import * as log from "@tauri-apps/plugin-log";
import { join } from "@tauri-apps/api/path";
import { dbDir } from "@/utils/fs";
import {
  APP_DATABASE_FILE,
  APP_DEV_DATABASE_FILE,
  ASSET_CATEGORIES_TABLE_NAME,
} from "@/constants";
import i18n from "i18next";
import {
  ANONYMOUS_USER_UUID,
  getUsernameByUuid,
  ANONYMOUS_USER,
} from "@/services/user";
import { User } from "@/services/user";

/**
 * @description 用于防止数据库初始化逻辑并发执行的异步锁。
 * 一旦初始化开始，这个 Promise 就会被赋值。
 * 后续的调用会等待这个 Promise 完成，而不是重新开始初始化。
 */
let initializationPromise: Promise<string> | null = null;

// 关键修复：使用两个变量来管理状态
let instance: Database | null = null; // 缓存已解析的数据库实例
let promise: Promise<Database> | null = null; // 缓存正在加载中的 Promise

/**
 * 获取数据库连接的单例实例，此实现可抵御并发调用下的竞态条件。
 * @returns {Promise<Database>} 唯一的数据库连接实例。
 */
export async function getDb(): Promise<Database> {
  // 1. 如果实例已存在，直接返回，这是最高效的路径。
  if (instance) {
    return instance;
  }

  // 2. 如果实例不存在，但已有正在加载的 Promise，则等待该 Promise 完成。
  //    这可以防止并发调用重复创建实例。
  if (promise) {
    return promise;
  }

  // 3. 如果实例和 Promise 都不存在，则这是第一个调用，开始创建实例。
  //    我们将创建过程包装在 Promise 中，并将其赋值给 'promise' 变量充当“锁”。
  promise = (async () => {
    try {
      log.info("[DB] 数据库连接实例不存在，正在创建新的单例实例...");

      const dbPath = import.meta.env.PROD
        ? await join(await dbDir(), APP_DATABASE_FILE)
        : await join(await dbDir(), APP_DEV_DATABASE_FILE);
      const dbUrl = `sqlite:${dbPath}`;

      log.debug(`[DB] 正在加载数据库: ${dbUrl}`);
      const db = await Database.load(dbUrl);
      await db.execute("PRAGMA foreign_keys = ON");
      await db.execute("PRAGMA busy_timeout = 5000");
      try {
        await db.execute("PRAGMA journal_mode = WAL");
        await db.execute("PRAGMA synchronous = NORMAL");
      } catch (err) {
        log.warn(`[DB] 设置 WAL 或同步模式失败，继续运行: ${err}`);
      }
      log.debug("[DB] 外键约束与 busy_timeout 已开启。");

      // 加载成功后，将实例缓存起来，以便后续调用直接返回
      instance = db;
      log.info("[DB] ✅ 数据库单例实例创建成功并已缓存。");

      return instance;
    } catch (error) {
      log.error(`[DB] ❌ 数据库初始化失败: ${error}`);
      // 初始化失败时，将 promise 重置为 null，以便下次调用可以重试
      promise = null;
      throw new Error(`数据库初始化失败: ${error}`);
    }
  })();

  return promise;
}

/**
 * 通用的数据库客户端，现在它会通过防竞态条件的 getDb() 获取连接。
 */
export const dbClient = {
  /**
   * 执行一个会修改数据库的SQL语句 (INSERT, UPDATE, DELETE)。
   * @param query SQL 查询语句。
   * @param params 可选的参数数组。
   * @returns Promise，解析后为包含受影响行数和最后插入ID的对象。
   */
  async execute(query: string, params?: any[]): Promise<QueryResult> {
    // 每次都通过 getDb 获取单例实例
    const db = await getDb();
    try {
      return await db.execute(query, params);
    } catch (e) {
      log.error(`SQL 执行失败: ${query} | 参数: ${params} | 错误: ${e}`);
      throw e;
    }
  },

  /**
   * 执行一个查询并返回结果集。
   * @param query SQL SELECT 语句。
   * @param params 可选的参数数组。
   * @returns Promise，解析后为查询结果的数组。
   */
  async select<T>(query: string, params?: any[]): Promise<T[]> {
    const db = await getDb();
    try {
      return await db.select<T[]>(query, params);
    } catch (e) {
      log.error(`SQL 查询失败: ${query} | 参数: ${params} | 错误: ${e}`);
      throw e;
    }
  },
};

/**
 * 获取默认分类的uuid
 * @param {string} get - 环境的 UUID。
 * @returns {Promise<string | null>}
 */
export async function getDefaultCategoryUuid(): Promise<string | null> {
  const categories = await dbClient.select<{ uuid: string }>(
    `SELECT uuid FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = $2`,
    [ANONYMOUS_USER_UUID, 1],
  );
  return categories[0]?.uuid || null;
}

/**
 *  通过用户uuid查找资产分类的uuid
 */
export async function getCategoryUuidForUser(
  userUuid: string,
): Promise<string | null> {
  const categories = await dbClient.select<{ uuid: string }>(
    `SELECT uuid FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1`,
    [userUuid],
  );
  return categories[0]?.uuid || null;
}

/**
 *  通过用户的uuid获取默认资产分类uuid
 */
export async function getDefaultCategoryUuidForUser(
  userUuid: string,
): Promise<string | null> {
  const categories = await dbClient.select<{ uuid: string }>(
    `SELECT uuid FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = 1`,
    [userUuid],
  );
  return categories[0]?.uuid || null;
}

/**
 * @function _ensureDefaultCategoryExists
 * @description (内部函数) 确保指定用户的默认分类存在。此函数是幂等的。
 * @param userUuid - 用户的UUID。
 */
async function _ensureDefaultCategoryExists(userUuid: string): Promise<void> {
  // 通过 is_default 标志检查，而不是通过名称
  const existing = await dbClient.select(
    `SELECT 1 FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = 1`,
    [userUuid],
  );
  if (existing.length === 0) {
    const defaultCategoryName = i18n.t(
      "management.asset.category.defaultCategory",
    );

    const randomUuid = crypto.randomUUID();
    log.info(
      `【${await getUsernameByUuid(
        userUuid,
      )}】用户的默认资产分类不存在，正在创建【${defaultCategoryName}】分类，uuid：${randomUuid}`,
    );
    // 插入时设置 is_default = 1
    await dbClient.execute(
      `INSERT INTO ${ASSET_CATEGORIES_TABLE_NAME} (uuid, user_uuid, name, is_default) VALUES ($1, $2, $3, 1)`,
      [randomUuid, userUuid, defaultCategoryName],
    );
  }
}

/**
 * 如果不存在匿名用户，就创建匿名用户和匿名资产分类
 *
 * 如果用户缺少默认资产分类还会创建一个默认的资产分类。
 * @returns {Promise<string>} 默认环境的 UUID。
 */
export async function initDb(): Promise<string> {
  // 如果初始化过程已在进行中，则等待其完成并返回结果，避免重复执行。
  if (initializationPromise) {
    return initializationPromise;
  }

  // 创建一个新的 Promise 来包裹整个初始化逻辑，并立即将其赋值给 initializationPromise 作为“锁”。
  initializationPromise = (async () => {
    try {
      const users = await dbClient.select(
        "SELECT 1 FROM users WHERE uuid = $1",
        [ANONYMOUS_USER_UUID],
      );
      if (users.length === 0) {
        log.info(`匿名用户不存在，正在创建【${ANONYMOUS_USER}】用户...`);
        await dbClient.execute(
          "INSERT INTO users (uuid, username, is_logged_in) VALUES ($1, $2, 1)", // 匿名用户始终是登录状态
          [ANONYMOUS_USER_UUID, ANONYMOUS_USER],
        );
      }

      await _ensureDefaultCategoryExists(ANONYMOUS_USER_UUID);

      return ANONYMOUS_USER_UUID;
    } catch (error) {
      // 如果初始化过程中发生任何错误，则重置锁，以便下次可以重试。
      initializationPromise = null;
      log.error(`异常的错误: ${error}`);
      throw error; // 将错误继续抛出，以便上层调用者可以捕获。
    }
  })();

  return initializationPromise;
}

/**
 * 保存或更新一个用户信息到本地数据库。
 * @param user - 包含 uuid 和 username 的用户对象
 */
export async function saveUser(user: User): Promise<void> {
  const existingUser = await dbClient.select(
    "SELECT 1 FROM users WHERE uuid = $1",
    [user.uuid],
  );

  if (existingUser.length === 0) {
    await dbClient.execute(
      "INSERT INTO users (uuid, username, server_address, server_instance_uuid, token) VALUES ($1, $2, $3, $4, $5)",
      [
        user.uuid,
        user.username,
        user.serverAddress,
        user.serverInstanceUuid,
        user.token,
      ],
    );
    // 新用户保存后，也为他们创建默认分类
    await _ensureDefaultCategoryExists(user.uuid);
    log.info(`新用户 ${user.username} (${user.uuid}) 已保存至本地数据库。`);
  } else {
    // / 更新用户信息
    await dbClient.execute(
      "UPDATE users SET username = $1, server_address = $2, server_instance_uuid = $3, token = $4 WHERE uuid = $5",
      [
        user.username,
        user.serverAddress,
        user.serverInstanceUuid,
        user.token,
        user.uuid,
      ],
    );
  }
}
