import { invoke } from "@tauri-apps/api/core";
import { dbClient } from "./db";
import { User, updateUsername } from "./user";
import { ensureSaleColumns } from "./assetDb";
import {
  WEBSITE_GROUPS_TABLE_NAME,
  WEBSITES_TABLE_NAME,
  ASSET_CATEGORIES_TABLE_NAME,
  ASSET_TABLE_NAME,
  SYNC_METADATA_TABLE_NAME,
  SEARCH_ENGINES_TABLE_NAME,
} from "@/constants";
import * as log from "@tauri-apps/plugin-log";
import { readDir } from "@tauri-apps/plugin-fs";
import { getIconsDir } from "@/utils/fs";
import { uploadIcons, downloadIcons } from "./iconSync";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
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
import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getVersion } from "@tauri-apps/api/app";

const CHUNK_SIZE = 100; // 每块传输 100 条记录
const MIN_SERVER_VERSION = "0.0.3";

const isVersionGte = (version: string, minimum: string): boolean => {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(version);
  const [b1, b2, b3] = parse(minimum);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 >= b3;
};

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
  t: (key: string, options?: any) => string
) {
  if (data.length === 0) {
    log.info(`[同步] 无需同步数据: ${dataType}`);
    return;
  }
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
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
    await invoke("sync_chunk", { user, payload: chunkPayload });
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

  try {
    // 1. 验证用户和版本
    await runSyncPrerequisites(user, updaters);

    // 2. 收集本地数据和图标
    setSyncMessage(t("sync.collectingLocalData"));
    let localIcons: string[] = [];
    try {
      const iconsDir = await getIconsDir();
      const entries = await readDir(iconsDir);
      localIcons = entries.map((entry) => entry.name).filter(Boolean) as string[];
    } catch (e) {
      log.warn(`扫描本地图标目录失败: ${e}。`);
    }

    // 3. 开始同步会话
    setSyncMessage(t("sync.startingSession"));
    const startPayload: ClientSyncPayload = {
      user_uuid: user.uuid,
      last_synced_at: (await getLastSyncTimestamp(user.uuid)) || "1970-01-01T00:00:00.000Z",
    };
    const startResponse: ApiResponse<StartSyncResponse> = await invoke(
      "sync_start",
      { user, payload: startPayload }
    );
    if (!startResponse.success || !startResponse.data) {
      throw new Error(`开启同步会话失败: ${startResponse.message}`);
    }
    const sessionId = startResponse.data.session_id;

    // 4. 分块发送各类数据
    const dataToSend = [
      { type: DataType.WebsiteGroups, query: `SELECT uuid, name, description, sort_order, is_deleted, updated_at FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = $1` },
      { type: DataType.Websites, query: `SELECT uuid, group_uuid, title, url, url_lan, default_icon, local_icon_path, background_color, description, sort_order, is_deleted, updated_at FROM ${WEBSITES_TABLE_NAME} WHERE user_uuid = $1` },
      { type: DataType.AssetCategories, query: `SELECT uuid, name, is_default, is_deleted, updated_at FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1` },
      {
        type: DataType.Assets,
        query: `SELECT uuid, category_uuid, name, purchase_date, price, expiration_date, description, is_deleted, updated_at, brand, model, serial_number, status, sale_price, sale_date, fees, buyer, notes, realized_profit FROM ${ASSET_TABLE_NAME} WHERE user_uuid = $1`,
      },
      { type: DataType.SearchEngines, query: `SELECT uuid, name, url_template, default_icon, local_icon_path, is_default, sort_order, updated_at FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE user_uuid = $1` },
    ];

    for (const { type, query } of dataToSend) {
      const data = await dbClient.select<any[]>(query, [user.uuid]);
      await sendDataInChunks(user, sessionId, type, data, setSyncMessage, t);
    }

    // 单独处理并发送 localIcons
    await sendDataInChunks(user, sessionId, DataType.LocalIcons, localIcons, setSyncMessage, t);

    // 5. 完成同步会话并处理服务器返回的数据
    setSyncMessage(t("sync.completingSync"));
    const completeResponse: ApiResponse<ServerSyncData> = await invoke(
      "sync_complete",
      { user, sessionId }
    );

    if (!completeResponse.success || !completeResponse.data) {
      throw new Error(`完成同步失败: ${completeResponse.message}`);
    }

    const serverData = completeResponse.data;

    if (serverData.sync_data) {
      setSyncMessage(t("sync.updatingLocalDb"));
      await processServerData(user.uuid, serverData.sync_data);
    }

    if (serverData.icons_to_upload?.length > 0) {
      setSyncMessage(t("sync.uploadingIcons", { num: serverData.icons_to_upload.length }));
      await uploadIcons(serverData.icons_to_upload);
    }
    if (serverData.icons_to_download?.length > 0) {
      setSyncMessage(t("sync.downloadingIcons", { num: serverData.icons_to_download.length }));
      await downloadIcons(serverData.icons_to_download);
    }

    await updateLastSyncTimestamp(user.uuid, serverData.current_synced_at);
    incrementDataVersion();
    setSyncMessage(t("sync.syncSuccess"));

  } catch (error) {
    setSyncMessage(t("sync.syncFailed", { error: error }));
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
export async function getLastSyncTimestamp(
  userUuid: string
): Promise<string | null> {
  try {
    const result = await dbClient.select<{ last_synced_at: string }>(
      `SELECT last_synced_at FROM ${SYNC_METADATA_TABLE_NAME} WHERE user_uuid = $1`,
      [userUuid]
    );

    // select 方法总是返回一个数组，即使只有一条或零条记录
    if (result.length > 0) {
      // 成功找到记录，返回时间戳
      return result[0].last_synced_at;
    } else {
      // 如果没有找到记录（例如，该用户从未同步过），则返回 null
      log.info(`用户 ${userUuid} 尚未有同步记录。`);
      return null;
    }
  } catch (error) {
    log.error(`查询 last_synced_at 失败: ${error}`);
    // 发生错误时也返回 null，让调用方处理
    return null;
  }
}

/**
 * @function updateLastSyncTimestamp
 * @description 为指定用户插入或更新其最后同步成功的时间戳。
 * @param {string} userUuid - 用户的 UUID。
 * @param {string} timestamp - 最新的同步时间戳，通常由服务器在同步成功后返回。
 * @returns {Promise<void>}
 */
export async function updateLastSyncTimestamp(
  userUuid: string,
  timestamp: string
): Promise<void> {
  try {
    const query = `
      INSERT INTO ${SYNC_METADATA_TABLE_NAME} (user_uuid, last_synced_at)
      VALUES ($1, $2)
      ON CONFLICT(user_uuid) DO UPDATE SET
        last_synced_at = excluded.last_synced_at;
    `;

    await dbClient.execute(query, [userUuid, timestamp]);

    log.info(`用户 ${userUuid} 的 last_synced_at 已成功更新为: ${timestamp}`);
  } catch (error) {
    log.error(`更新 last_synced_at 失败: ${error}`);
    // 在实际应用中，这里可能需要向上抛出错误，以便同步流程可以回滚
    throw error;
  }
}
