import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readDir } from "@tauri-apps/plugin-fs";
import * as log from "@tauri-apps/plugin-log";
import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  WEBSITE_GROUPS_TABLE_NAME,
  WEBSITES_TABLE_NAME,
  ASSET_CATEGORIES_TABLE_NAME,
  ASSET_TABLE_NAME,
  SYNC_METADATA_TABLE_NAME,
  SEARCH_ENGINES_TABLE_NAME,
} from "@/constants";
import { getIconsDir } from "@/utils/fs";
import {
  CurrentUserPayload,
  ServerSyncData,
  SyncDataDto,
  SyncStatusUpdaters,
  ApiResponse,
  AssetCategoryDto,
  WebsiteGroupDto,
  ClientSyncPayload,
  StartSyncResponse,
  DataType,
  ClientSyncDataChunk,
  ClientInfoDto,
  VersionInfo,
} from "@/types/sync";
import { dbClient } from "./db";
import {
  ANONYMOUS_USER,
  ANONYMOUS_USER_UUID,
  User,
  deleteUserWithData,
  setUserLoginStatus,
  updateUsername,
} from "./user";
import { ensureSaleColumns } from "./assetDb";
import { uploadIcons, downloadIcons } from "./iconSync";

const DEFAULT_CHUNK_SIZE =
  Number((import.meta as any).env?.VITE_SYNC_CHUNK_SIZE ?? 100) || 100; // 支持环境变量覆盖，默认 100
const MIN_SERVER_VERSION = "0.0.5";
const ACCOUNT_DELETED_CODE = 403;
const ACCOUNT_NOT_FOUND_CODE = 401;
const ACCOUNT_DISABLED_CODE = 403;
const TOKEN_EXPIRED_CODE = 401;

const isAccountDeletedMessage = (message: string | undefined) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("账号已被删除") ||
    lower.includes("account has been deleted") ||
    lower.includes("account deleted")
  );
};

const isAccountNotFoundMessage = (message: string | undefined) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("用户不存在") ||
    lower.includes("account not found") ||
    lower.includes("user not found")
  );
};

const isTokenExpiredMessage = (message: string | undefined) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("过期的令牌") ||
    lower.includes("token expired") ||
    lower.includes("jwt expired") ||
    lower.includes("expired token")
  );
};

const isAccountDeletedResponse = (resp?: ApiResponse<any>) =>
  !!resp &&
  !resp.success &&
  ((resp.code === ACCOUNT_DELETED_CODE &&
    isAccountDeletedMessage(resp.message)) ||
    (resp.code === ACCOUNT_NOT_FOUND_CODE &&
      isAccountNotFoundMessage(resp.message)));

const isAccountDisabledMessage = (message: string | undefined) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("账号已被禁用") ||
    lower.includes("account has been disabled") ||
    lower.includes("account disabled")
  );
};

const isAccountDisabledResponse = (resp?: ApiResponse<any>) =>
  !!resp &&
  !resp.success &&
  resp.code === ACCOUNT_DISABLED_CODE &&
  isAccountDisabledMessage(resp.message);

const isTokenExpiredResponse = (resp?: ApiResponse<any>) =>
  !!resp &&
  !resp.success &&
  resp.code === TOKEN_EXPIRED_CODE &&
  isTokenExpiredMessage(resp.message);

const isVersionGte = (version: string, minimum: string): boolean => {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(version);
  const [b1, b2, b3] = parse(minimum);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 >= b3;
};

// 统一格式化错误日志，便于排查 invoke/网络层返回的原始信息
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function tryParseApiResponse(err: unknown): ApiResponse<any> | undefined {
  if (!err) return undefined;
  if (typeof err === "object" && "success" in err && "code" in err) {
    return err as ApiResponse<any>;
  }
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return undefined;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  const jsonText = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonText);
    if (
      parsed &&
      typeof parsed === "object" &&
      "success" in parsed &&
      "code" in parsed
    ) {
      return parsed as ApiResponse<any>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// 同步日志：插入一条记录
async function createSyncLog(
  sessionId: string,
  userUuid: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await dbClient.execute(
      `INSERT INTO sync_logs (session_id, user_uuid, started_at, status) VALUES ($1, $2, $3, 'running')`,
      [sessionId, userUuid, now]
    );
  } catch (error) {
    log.warn(`写入同步日志失败（create）：${formatError(error)}`);
  }
}

// 同步日志：更新状态/摘要/错误
async function finalizeSyncLog(
  sessionId: string,
  status: "success" | "failed",
  summary?: string,
  errorText?: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await dbClient.execute(
      `
        UPDATE sync_logs
        SET finished_at = $1, status = $2, summary = $3, error = $4
        WHERE session_id = $5
      `,
      [now, status, summary || null, errorText || null, sessionId]
    );
  } catch (error) {
    log.warn(`写入同步日志失败（finalize）：${formatError(error)}`);
  }
}

/**
 * @function processServerData
 * @brief 处理服务器返回的同步数据。包含了对“资产分类”和“网站分组”的完整冲突处理逻辑，并附有详细日志。
 * @param userUuid 当前登录用户的 UUID。
 * @param syncData 从服务器接收到的同步数据。
 */
const processServerData = async (userUuid: string, syncData: SyncDataDto) => {
  log.info("✔️ 数据处理流程启动...");
  await ensureSaleColumns();

  // =================================================================
  // 阶段一：特殊处理资产分类的默认值冲突
  // =================================================================
  const serverCategories = syncData.asset_categories;
  const serverDefault = serverCategories?.find((c) => c.is_default === 1);
  let conflictingDefaults: AssetCategoryDto[] = [];

  if (serverDefault) {
    log.info(
      `[资产分类] 服务器权威默认分类已识别: (UUID: ${serverDefault.uuid}, 名称: "${serverDefault.name}")`
    );

    const localDefaults = await dbClient.select<AssetCategoryDto>(
      `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = 1`,
      [userUuid]
    );

    conflictingDefaults = localDefaults.filter(
      (ld) => ld.uuid !== serverDefault.uuid
    );

    if (conflictingDefaults.length > 0) {
      log.warn(
        `[资产分类] ⚠️ 检测到 ${conflictingDefaults.length} 个本地默认分类与服务器冲突，启动“降级-扶正-清理”流程...`
      );

      for (const localDefault of conflictingDefaults) {
        log.info(
          `[资产分类] ➡️ 正在处理冲突项: (UUID: ${localDefault.uuid}, 名称: "${localDefault.name}")`
        );

        // 步骤 1.1: 降级并重命名
        const deprecatedName = `${localDefault.name}_deprecated_${Date.now()}`;
        await dbClient.execute(
          `UPDATE ${ASSET_CATEGORIES_TABLE_NAME} SET is_default = 0, name = $1 WHERE uuid = $2`,
          [deprecatedName, localDefault.uuid]
        );
        log.info(
          `[资产分类] ✅ [降级] 已将本地旧默认分类 ${localDefault.uuid} 的 is_default 设为 0，并重命名为 "${deprecatedName}"。`
        );
      }

      // 步骤 1.2: 扶正
      log.info(
        `[资产分类] ➡️ [扶正] 正在插入/更新权威默认分类 ${serverDefault.uuid}，确保其 is_default 为 1。`
      );
      const recordWithUser = { ...serverDefault, user_uuid: userUuid };
      const columns = Object.keys(recordWithUser);
      const values = Object.values(recordWithUser);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const updateSet = Object.keys(serverDefault)
        .filter((col) => col !== "uuid")
        .map((col) => `${col} = excluded.${col}`)
        .join(", ");
      const upsertSql = `INSERT INTO ${ASSET_CATEGORIES_TABLE_NAME} (${columns.join(
        ","
      )}) VALUES (${placeholders}) ON CONFLICT(uuid) DO UPDATE SET ${updateSet};`;
      await dbClient.execute(upsertSql, values as any[]);
      log.info(
        `[资产分类] ✅ [扶正] 权威默认分类 ${serverDefault.uuid} 已成功写入本地数据库。`
      );

      // 步骤 1.3: 迁移并清理
      for (const localDefault of conflictingDefaults) {
        log.info(
          `[资产分类] ➡️ [迁移] 正在将资产从旧分类 ${localDefault.uuid} 迁移至权威分类 ${serverDefault.uuid}...`
        );
        const migrationResult = await dbClient.execute(
          `UPDATE ${ASSET_TABLE_NAME} SET category_uuid = $1 WHERE category_uuid = $2`,
          [serverDefault.uuid, localDefault.uuid]
        );
        log.info(
          `[资产分类] ✅ [迁移] ${migrationResult.rowsAffected} 条资产已成功迁移。`
        );

        log.info(
          `[资产分类] ➡️ [清理] 正在删除已无用的旧默认分类 ${localDefault.uuid}...`
        );
        await dbClient.execute(
          `DELETE FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE uuid = $1`,
          [localDefault.uuid]
        );
        log.info(
          `[资产分类] ✅ [清理] 已成功删除旧默认分类 ${localDefault.uuid}。`
        );
      }
    }
  }

  // =================================================================
  // 阶段二：特殊处理网站分组的名称冲突
  // =================================================================
  const serverGroups = syncData.website_groups;
  const localGroups = await dbClient.select<WebsiteGroupDto>(
    `SELECT * FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = $1`,
    [userUuid]
  );
  const groupsToClean = new Set<string>();

  for (const serverGroup of serverGroups) {
    const localConflict = localGroups.find(
      (lg) => lg.name === serverGroup.name && lg.uuid !== serverGroup.uuid
    );
    if (localConflict) {
      log.warn(
        `[网站分组] ⚠️ 检测到名称冲突: "${serverGroup.name}"。本地UUID: ${localConflict.uuid}, 服务器权威UUID: ${serverGroup.uuid}。启动合并流程...`
      );

      // 步骤 2.1: 重命名本地冲突项
      const deprecatedName = `${localConflict.name}_deprecated_${Date.now()}`;
      await dbClient.execute(
        `UPDATE ${WEBSITE_GROUPS_TABLE_NAME} SET name = $1 WHERE uuid = $2`,
        [deprecatedName, localConflict.uuid]
      );
      log.info(
        `[网站分组] ✅ [重命名] 已将本地冲突分组 ${localConflict.uuid} 重命名为 "${deprecatedName}"。`
      );

      // 步骤 2.2: 迁移子记录
      log.info(
        `[网站分组] ➡️ [迁移] 正在将网站从旧分组 ${localConflict.uuid} 迁移至权威分组 ${serverGroup.uuid}...`
      );
      const migrationResult = await dbClient.execute(
        `UPDATE ${WEBSITES_TABLE_NAME} SET group_uuid = $1 WHERE group_uuid = $2`,
        [serverGroup.uuid, localConflict.uuid]
      );
      log.info(
        `[网站分组] ✅ [迁移] ${migrationResult.rowsAffected} 个网站已成功迁移。`
      );

      // 步骤 2.3: 标记待清理
      groupsToClean.add(localConflict.uuid);
      log.info(
        `[网站分组] ➡️ [标记] 已将旧分组 ${localConflict.uuid} 标记为待清理。`
      );
    }
  }

  // =================================================================
  // 阶段三：常规处理所有数据
  // =================================================================
  const allConflictingCategoryUuids = conflictingDefaults.map((d) => d.uuid);
  const otherCategories = serverCategories?.filter(
    (c) =>
      c.uuid !== serverDefault?.uuid &&
      !allConflictingCategoryUuids.includes(c.uuid)
  );

  const tables = [
    { name: WEBSITE_GROUPS_TABLE_NAME, data: serverGroups },
    { name: WEBSITES_TABLE_NAME, data: syncData.websites },
    { name: ASSET_CATEGORIES_TABLE_NAME, data: otherCategories },
    { name: ASSET_TABLE_NAME, data: syncData.assets },
    { name: SEARCH_ENGINES_TABLE_NAME, data: syncData.search_engines },
  ];

  log.info("✔️ 开始执行所有表的常规UPSERT操作...");
  try {
    for (const table of tables) {
      if (!table.data || table.data.length === 0) continue;

      log.info(`[常规更新] 正在处理表: ${table.name}...`);
      for (const record of table.data) {
        const recordWithUser = { ...record, user_uuid: userUuid };
        const columns = Object.keys(recordWithUser);
        const values = Object.values(recordWithUser);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const updateSet = Object.keys(record)
          .filter((col) => col !== "uuid")
          .map((col) => `${col} = excluded.${col}`)
          .join(", ");

        const sql = `INSERT INTO ${table.name} (${columns.join(
          ", "
        )}) VALUES (${placeholders}) ON CONFLICT(uuid) DO UPDATE SET ${updateSet};`;
        await dbClient.execute(sql, values as any[]);
      }
      log.info(`[常规更新] ✅ 表 ${table.name} 的数据已处理完毕。`);
    }
  } catch (error) {
    log.error(`[常规更新] ❌ 常规数据更新过程中发生错误: ${error}`);
    throw new Error(`更新本地数据失败: ${error}`);
  }

  // =================================================================
  // 阶段四：执行最终清理
  // =================================================================
  if (groupsToClean.size > 0) {
    log.info(`✔️ 开始清理 ${groupsToClean.size} 个已合并的旧网站分组...`);
    for (const uuidToClean of groupsToClean) {
      await dbClient.execute(
        `DELETE FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE uuid = $1`,
        [uuidToClean]
      );
      log.info(`[最终清理] ✅ 已成功清理旧分组: ${uuidToClean}`);
    }
  }

  log.info("✔️✔️✔️ 全部数据处理流程成功完成！");
};

/**
 * @function runSyncPrerequisites
 * @brief 执行同步前的准备和验证工作，包括验证用户 Token 和设置用户重命名监听器。
 * @description 这是同步流程的第一个关键步骤，未来可在此添加服务端兼容性检查等逻辑。
 * @param {User} user - 当前登录的用户对象。
 * @param {SyncStatusUpdaters} updaters - 用于更新 UI 状态和 Auth Context 的回调函数集合。
 * @returns {Promise<void>}
 */
const runSyncPrerequisites = async (
  user: User,
  {
    setSyncMessage,
    switchActiveUser,
    refreshAvailableUsers,
    t,
  }: SyncStatusUpdaters
): Promise<void> => {
  setSyncMessage(t("sync.verifyingUser"));

  const appWebview = getCurrentWebviewWindow();
  let unlisten: (() => void) | undefined;

  try {
    // 监听后端发来的用户重命名事件
    unlisten = await appWebview.listen<CurrentUserPayload>(
      "user-rename",
      async (event) => {
        const newUsername = event.payload.username;
        // 更新数据库
        await updateUsername(user.uuid, newUsername);
        // 更新 AuthContext 状态
        const updatedUser = { ...user, username: newUsername };
        switchActiveUser(updatedUser);
        await refreshAvailableUsers();

        if (await isPermissionGranted()) {
          sendNotification({
            title: t("account.dataSync"),
            body: t("sync.serverUserUpdated"),
            icon: "logo.svg",
            largeIcon: "logo.svg",
            autoCancel: true,
          });
        }
        log.info("本地用户名和状态已同步更新。");
      }
    );

    // 验证用户 Token
    const clientInfoDto: ClientInfoDto = {
      app_version: await getVersion(),
      username: user.username,
      token: user.token || "",
      server_address: user.serverAddress || "",
    };

    /// 校验 Token 和 用户名是否发送变更
    await invoke("check_token_and_user", {
      client_info: clientInfoDto,
    });

    /// 校验版本兼容性
    await invoke("check_client_version", {
      client_info: clientInfoDto,
    });

    // 校验服务器版本
    setSyncMessage(t("sync.verifyingServer"));
    if (!user.serverAddress) {
      throw new Error("服务器地址未配置，无法校验版本");
    }
    const serverVersionResp: ApiResponse<VersionInfo> = await invoke(
      "check_server_version",
      { server_address: user.serverAddress }
    );
    const serverVersion = serverVersionResp.data?.version;
    if (!serverVersion || !isVersionGte(serverVersion, MIN_SERVER_VERSION)) {
      throw new Error(
        t("sync.serverTooOld", {
          version: serverVersion || "unknown",
          required: MIN_SERVER_VERSION,
        })
      );
    }

    // 添加兼容性验证等
  } finally {
    // 清理监听器
    if (unlisten) {
      unlisten();
    }
  }
};

const handleAccountDeletedOnServer = async (
  user: User,
  updaters: SyncStatusUpdaters,
  serverMessage?: string
) => {
  const {
    setSyncMessage,
    switchActiveUser,
    refreshAvailableUsers,
    incrementDataVersion,
    t,
  } = updaters;

  setSyncMessage(
    t("sync.accountDeletedOnServer", { reason: serverMessage || "" })
  );

  try {
    await deleteUserWithData(user.uuid);
    const users = await refreshAvailableUsers();
    const anonymous = users.find((u) => u.uuid === ANONYMOUS_USER_UUID) || {
      uuid: ANONYMOUS_USER_UUID,
      username: ANONYMOUS_USER,
      isLoggedIn: 1,
    };

    switchActiveUser(anonymous);
    incrementDataVersion();
    setSyncMessage(t("sync.accountDeletedCleanupDone"));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`服务器删除账号，本地清理失败: ${errMsg}`);
    setSyncMessage(t("sync.accountDeletedCleanupFailed", { error: errMsg }));
  }
};

const handleAccountDisabledOnServer = async (
  user: User,
  updaters: SyncStatusUpdaters,
  serverMessage?: string
) => {
  const { setSyncMessage, switchActiveUser, refreshAvailableUsers, t } =
    updaters;

  setSyncMessage(
    t("sync.accountDisabledOnServer", { reason: serverMessage || "" })
  );

  try {
    await setUserLoginStatus(user.uuid, false);
    const users = await refreshAvailableUsers();
    const anonymous = users.find((u) => u.uuid === ANONYMOUS_USER_UUID) || {
      uuid: ANONYMOUS_USER_UUID,
      username: ANONYMOUS_USER,
      isLoggedIn: 1,
    };
    switchActiveUser(anonymous);
    setSyncMessage(t("sync.accountDisabledSignedOut"));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`服务器禁用账号，本地登出失败: ${errMsg}`);
    setSyncMessage(t("sync.accountDisabledSignoutFailed", { error: errMsg }));
  }
};

const handleTokenExpiredOnServer = async (
  user: User,
  updaters: SyncStatusUpdaters,
  serverMessage?: string
) => {
  const { setSyncMessage, switchActiveUser, refreshAvailableUsers, t } =
    updaters;

  setSyncMessage(
    t("sync.tokenExpiredOnServer", { reason: serverMessage || "" })
  );

  try {
    await setUserLoginStatus(user.uuid, false);
    const users = await refreshAvailableUsers();
    const anonymous = users.find((u) => u.uuid === ANONYMOUS_USER_UUID) || {
      uuid: ANONYMOUS_USER_UUID,
      username: ANONYMOUS_USER,
      isLoggedIn: 1,
    };
    switchActiveUser(anonymous);
    setSyncMessage(t("sync.tokenExpiredSignedOut"));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error(`令牌过期，本地登出失败: ${errMsg}`);
    setSyncMessage(t("sync.tokenExpiredSignoutFailed", { error: errMsg }));
  }
};
/**
 * @function sendDataInChunks
 * @description 将指定类型的数据分块发送到服务器。
 * @param sessionId - 当前同步会话的 ID。
 * @param dataType - 要发送的数据类型。
 * @param data - 包含所有待发送记录的数组。
 * @param setSyncMessage - 用于更新 UI 状态的函数。
 * @param t - i18next 翻译函数。
 */
async function sendDataInChunks<T>(
  user: User, // 添加 user 参数
  sessionId: string,
  dataType: DataType,
  data: T[],
  setSyncMessage: (message: string) => void,
  t: (key: string, options?: any) => string,
  chunkSize: number
) {
  if (data.length === 0) {
    log.info(`[同步] 无需同步数据: ${dataType}`);
    return;
  }
  const totalChunks = Math.ceil(data.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    setSyncMessage(
      t("sync.sendingChunk", {
        type: t(`sync.dataType.${dataType}`),
        current: i + 1,
        total: totalChunks,
      })
    );
    const chunkPayload: ClientSyncDataChunk = {
      session_id: sessionId,
      data_type: dataType,
      chunk_data: chunk as any,
    };
    // 简单重试，避免网络波动导致同步中断
    let attempt = 0;
    const maxRetries = 3;
    while (true) {
      try {
        await invoke("sync_chunk", { user, payload: chunkPayload });
        break;
      } catch (err) {
        attempt += 1;
        const backoff = 300 * attempt;
        log.warn(
          `发送分块失败，正在重试(${attempt}/${maxRetries})，等待 ${backoff}ms: ${err}`
        );
        if (attempt >= maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
}

/**
 * @function startSync
 * @brief 启动完整的双向数据同步流程。
 * @param user 已登录的用户对象。
 * @param updaters 用于更新UI同步状态的回调函数集合。
 */
export const startSync = async (user: User, updaters: SyncStatusUpdaters) => {
  const {
    setIsSyncing,
    setSyncMessage,
    setSyncCompleted,
    incrementDataVersion,
    t,
  } = updaters;
  setIsSyncing(true);
  setSyncCompleted(false);

  let currentSessionId: string | undefined;

  try {
    // 动态分块大小，兼容服务器建议和本地默认
    let chunkSize = DEFAULT_CHUNK_SIZE;

    // 1. 验证用户和版本
    await runSyncPrerequisites(user, updaters);

    // 2. 收集本地数据和图标
    setSyncMessage(t("sync.collectingLocalData"));
    let localIcons: string[] = [];
    try {
      const iconsDir = await getIconsDir();
      const entries = await readDir(iconsDir);
      localIcons = entries
        .map((entry) => entry.name)
        .filter(Boolean) as string[];
    } catch (e) {
      log.warn(`扫描本地图标目录失败: ${e}。`);
    }

    // 3. 开始同步会话
    setSyncMessage(t("sync.startingSession"));
    const startPayload: ClientSyncPayload = {
      user_uuid: user.uuid,
      // 使用服务器分配的 rev 做增量游标，避免依赖客户端时钟
      last_synced_rev: await getLastSyncRevision(user.uuid),
    };
    const startResponse: ApiResponse<StartSyncResponse> = await invoke(
      "sync_start",
      { user, payload: startPayload }
    );
    if (!startResponse.success || !startResponse.data) {
      if (isTokenExpiredResponse(startResponse)) {
        await handleTokenExpiredOnServer(user, updaters, startResponse.message);
        return;
      }
      if (isAccountDisabledResponse(startResponse)) {
        await handleAccountDisabledOnServer(
          user,
          updaters,
          startResponse.message
        );
        return;
      }
      if (isAccountDeletedResponse(startResponse)) {
        await handleAccountDeletedOnServer(
          user,
          updaters,
          startResponse.message
        );
        return;
      }
      throw new Error(`开启同步会话失败: ${startResponse.message}`);
    }
    const sessionId = startResponse.data.session_id;
    currentSessionId = sessionId;
    await createSyncLog(sessionId, user.uuid);
    if (
      startResponse.data.suggested_chunk_size &&
      startResponse.data.suggested_chunk_size > 0
    ) {
      chunkSize = startResponse.data.suggested_chunk_size;
      log.info(`采用服务器建议的分块大小: ${chunkSize}`);
    }

    // 4. 分块发送各类数据
    const dataToSend = [
      {
        type: DataType.WebsiteGroups,
        query: `SELECT uuid, name, description, sort_order, is_deleted, rev, updated_at FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = $1`,
      },
      {
        type: DataType.Websites,
        query: `SELECT uuid, group_uuid, title, url, url_lan, default_icon, local_icon_path, background_color, description, sort_order, is_deleted, rev, updated_at FROM ${WEBSITES_TABLE_NAME} WHERE user_uuid = $1`,
      },
      {
        type: DataType.AssetCategories,
        query: `SELECT uuid, name, is_default, is_deleted, rev, updated_at FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1`,
      },
      {
        type: DataType.Assets,
        query: `SELECT uuid, category_uuid, name, purchase_date, price, expiration_date, description, is_deleted, rev, updated_at, brand, model, serial_number, status, sale_price, sale_date, fees, buyer, notes, realized_profit FROM ${ASSET_TABLE_NAME} WHERE user_uuid = $1`,
      },
      {
        type: DataType.SearchEngines,
        query: `SELECT uuid, name, url_template, default_icon, local_icon_path, is_default, sort_order, is_deleted, rev, updated_at FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE user_uuid = $1`,
      },
    ];

    for (const { type, query } of dataToSend) {
      const data = await dbClient.select<any[]>(query, [user.uuid]);
      await sendDataInChunks(
        user,
        sessionId,
        type,
        data,
        setSyncMessage,
        t,
        chunkSize
      );
    }

    // 单独处理并发送 localIcons
    await sendDataInChunks(
      user,
      sessionId,
      DataType.LocalIcons,
      localIcons,
      setSyncMessage,
      t,
      chunkSize
    );

    // 5. 完成同步会话并处理服务器返回的数据
    setSyncMessage(t("sync.completingSync"));
    let completeResponse: ApiResponse<ServerSyncData>;
    try {
      completeResponse = await invoke("sync_complete", { user, sessionId });
    } catch (err) {
      // 记录原始错误，便于排查 server/解析问题
      const errText = formatError(err);
      log.error(`sync_complete 调用失败: ${errText}`);
      throw err;
    }

    if (!completeResponse.success || !completeResponse.data) {
      if (isTokenExpiredResponse(completeResponse)) {
        await handleTokenExpiredOnServer(
          user,
          updaters,
          completeResponse.message
        );
        return;
      }
      if (isAccountDisabledResponse(completeResponse)) {
        await handleAccountDisabledOnServer(
          user,
          updaters,
          completeResponse.message
        );
        return;
      }
      if (isAccountDeletedResponse(completeResponse)) {
        await handleAccountDeletedOnServer(
          user,
          updaters,
          completeResponse.message
        );
        return;
      }
      throw new Error(`完成同步失败: ${completeResponse.message}`);
    }

    const serverData = completeResponse.data;

    if (serverData.sync_data) {
      setSyncMessage(t("sync.updatingLocalDb"));
      await processServerData(user.uuid, serverData.sync_data);
    }

    if (serverData.icons_to_upload?.length > 0) {
      setSyncMessage(
        t("sync.uploadingIcons", { num: serverData.icons_to_upload.length })
      );
      await uploadIcons(serverData.icons_to_upload);
    }
    if (serverData.icons_to_download?.length > 0) {
      setSyncMessage(
        t("sync.downloadingIcons", { num: serverData.icons_to_download.length })
      );
      await downloadIcons(serverData.icons_to_download);
    }

    await updateLastSyncRevision(user.uuid, serverData.current_synced_rev);
    incrementDataVersion();
    const summaryText = `同步完成：分组${serverData.website_groups_count}，网站${serverData.websites_count}，资产分类${serverData.categories_count}，资产${serverData.assets_count}，搜索引擎${serverData.search_engines_count}，已上传图标${serverData.icons_to_upload.length}，已下载图标${serverData.icons_to_download.length}`;
    // UI 仅展示简洁提示，详细信息写入日志
    setSyncMessage(t("sync.syncSuccess"));
    if (currentSessionId) {
      await finalizeSyncLog(currentSessionId, "success", summaryText);
    }
  } catch (error: any) {
    const apiResponse = tryParseApiResponse(error);
    const errorMessage =
      apiResponse?.message ||
      (error instanceof Error ? error.message : String(error));
    const isAccountDeleted =
      isAccountDeletedMessage(errorMessage) ||
      isAccountNotFoundMessage(errorMessage) ||
      (error &&
        typeof error === "object" &&
        "code" in error &&
        ((error as any).code === ACCOUNT_DELETED_CODE ||
          (error as any).code === ACCOUNT_NOT_FOUND_CODE) &&
        (isAccountDeletedMessage(String((error as any).message || "")) ||
          isAccountNotFoundMessage(String((error as any).message || ""))));
    const isAccountDisabled =
      isAccountDisabledMessage(errorMessage) ||
      (error &&
        typeof error === "object" &&
        "code" in error &&
        (error as any).code === ACCOUNT_DISABLED_CODE &&
        isAccountDisabledMessage(String((error as any).message || "")));
    const isTokenExpired =
      isTokenExpiredMessage(errorMessage) ||
      isTokenExpiredResponse(apiResponse) ||
      (error &&
        typeof error === "object" &&
        "code" in error &&
        (error as any).code === TOKEN_EXPIRED_CODE &&
        isTokenExpiredMessage(String((error as any).message || "")));

    if (isAccountDeleted) {
      await handleAccountDeletedOnServer(user, updaters, errorMessage);
      if (currentSessionId) {
        await finalizeSyncLog(
          currentSessionId,
          "failed",
          undefined,
          errorMessage
        );
      }
      return;
    }
    if (isAccountDisabled) {
      await handleAccountDisabledOnServer(user, updaters, errorMessage);
      if (currentSessionId) {
        await finalizeSyncLog(
          currentSessionId,
          "failed",
          undefined,
          errorMessage
        );
      }
      return;
    }
    if (isTokenExpired) {
      await handleTokenExpiredOnServer(user, updaters, errorMessage);
      if (currentSessionId) {
        await finalizeSyncLog(
          currentSessionId,
          "failed",
          undefined,
          errorMessage
        );
      }
      return;
    }

    setSyncMessage(t("sync.syncFailed", { error: errorMessage }));
    if (currentSessionId) {
      await finalizeSyncLog(
        currentSessionId,
        "failed",
        undefined,
        errorMessage
      );
    }
  } finally {
    setSyncCompleted(true);
  }
};

/**
 * @function getLastSyncTimestamp
 * @description 从数据库中获取指定用户的上一次同步时间戳。
 * @param {string} userUuid - 用户的 UUID。
 * @returns {Promise<string | null>} 如果找到了时间戳，则返回其字符串形式，否则返回 null。
 */
export async function getLastSyncRevision(userUuid: string): Promise<number> {
  try {
    const result = await dbClient.select<{ last_synced_rev: number }>(
      `SELECT last_synced_rev FROM ${SYNC_METADATA_TABLE_NAME} WHERE user_uuid = $1`,
      [userUuid]
    );

    if (result.length > 0 && typeof result[0].last_synced_rev === "number") {
      return result[0].last_synced_rev;
    }
    log.info(`用户 ${userUuid} 尚未有同步 rev 记录，默认返回 0。`);
    return 0;
  } catch (error) {
    log.error(`查询 last_synced_rev 失败: ${error}`);
    return 0;
  }
}

/**
 * @function updateLastSyncRevision
 * @description 在同步成功后，记录服务端返回的最新修订号，用于下一次增量同步。
 */
export async function updateLastSyncRevision(
  userUuid: string,
  revision: number
): Promise<void> {
  try {
    const query = `
      INSERT INTO ${SYNC_METADATA_TABLE_NAME} (user_uuid, last_synced_rev)
      VALUES ($1, $2)
      ON CONFLICT(user_uuid) DO UPDATE SET
        last_synced_rev = excluded.last_synced_rev;
    `;

    await dbClient.execute(query, [userUuid, revision]);

    log.info(`用户 ${userUuid} 的 last_synced_rev 已更新为: ${revision}`);
  } catch (error) {
    log.error(`更新 last_synced_rev 失败: ${error}`);
    throw error;
  }
}
