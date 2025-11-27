import { dbClient } from "./db";
import {
  WebsiteGroup,
  WebsiteItem,
  SearchEngine,
} from "@/features/Panel/types";
import { defaultWebsiteData } from "@/features/Panel/constants/panelItems";
import * as log from "@tauri-apps/plugin-log";
import { ANONYMOUS_USER_UUID, getUsernameByUuid } from "./user";
import {
  WEBSITE_GROUPS_TABLE_NAME,
  WEBSITES_TABLE_NAME,
  SEARCH_ENGINES_TABLE_NAME,
} from "@/constants";

let initializationAttempted = false;

async function ensureDefaultDataIsInitialized(): Promise<void> {
  if (initializationAttempted) return;
  initializationAttempted = true;
  // 检查表是否为空
  const [groupCount, itemCount] = await Promise.all([
    dbClient.select<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${WEBSITE_GROUPS_TABLE_NAME}`
    ),
    dbClient.select<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${WEBSITES_TABLE_NAME}`
    ),
  ]);

  if (groupCount[0].count > 0 || itemCount[0].count > 0) {
    log.info("已经有导航数据不需要再创建默认数据...");
    return;
  }

  try {
    await insertDefaultData(ANONYMOUS_USER_UUID);
  } catch (error) {
    initializationAttempted = false;
    log.error(`初始化默认导航数据失败: ${error}`);
    throw error;
  }
}

/**
 * 获取指定用户的所有网站数据（扁平化结构）。
 * @param userUuid - 要查询的用户的 UUID。
 * @returns {Promise<{ groups: WebsiteGroup[]; items: WebsiteItem[] }>} 返回包含分组和网站项独立数组的对象
 */
export async function getPanelData(
  userUuid: string
): Promise<{ groups: WebsiteGroup[]; items: WebsiteItem[] }> {
  if (userUuid === ANONYMOUS_USER_UUID) {
    await ensureDefaultDataIsInitialized();
  }

  const groups = await dbClient.select<WebsiteGroup>(
    `SELECT * FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = $1 AND is_deleted = 0 ORDER BY sort_order ASC, id ASC`,
    [userUuid]
  );

  if (groups.length === 0) {
    log.warn(`通过用户uuid ${userUuid} 未找到分组数据。`);
    return { groups: [], items: [] };
  }

  const items = await dbClient.select<WebsiteItem>(
    // 直接获取该用户的所有 item，而不是按 group uuid 查询
    `SELECT * FROM ${WEBSITES_TABLE_NAME} WHERE user_uuid = $1 AND is_deleted = 0 ORDER BY sort_order ASC, id ASC`,
    [userUuid]
  );

  return { groups, items };
}

/**
 * 保存（新增或更新）一个分组。
 */
export async function saveGroup(group: Partial<WebsiteGroup>): Promise<void> {
  if (group.uuid && group.id) {
    // 更新
    await dbClient.execute(
      `UPDATE ${WEBSITE_GROUPS_TABLE_NAME} SET name = $1, description = $2, sort_order = $3 WHERE uuid = $4`,
      [group.name, group.description, group.sort_order, group.uuid]
    );
  } else {
    // 新增
    if (!group.user_uuid) {
      throw new Error("新增分组时必须提供 user_uuid！");
    }
    await dbClient.execute(
      `INSERT INTO ${WEBSITE_GROUPS_TABLE_NAME} (uuid, user_uuid, name, description, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [
        crypto.randomUUID(),
        group.user_uuid,
        group.name,
        group.description,
        group.sort_order,
      ]
    );
  }
}

/**
 * 批量更新分组的排序。
 */
export async function updateGroupsOrder(
  groups: Pick<WebsiteGroup, "uuid">[]
): Promise<void> {
  for (const [index, group] of groups.entries()) {
    await dbClient.execute(
      `UPDATE ${WEBSITE_GROUPS_TABLE_NAME} SET sort_order = $1 WHERE uuid = $2`,
      [index + 1, group.uuid]
    );
  }
}

/**
 * 软删除一个分组及其下的所有网站项。
 */
export async function deleteGroup(groupUuid: string): Promise<void> {
  await dbClient.execute(
    `UPDATE ${WEBSITE_GROUPS_TABLE_NAME} SET is_deleted = 1 WHERE uuid = $1`,
    [groupUuid]
  );
  await dbClient.execute(
    `UPDATE ${WEBSITES_TABLE_NAME} SET is_deleted = 1 WHERE group_uuid = $1`,
    [groupUuid]
  );
}

/**
 * 保存（新增或更新）一个网站项。
 */
export async function saveItem(item: Partial<WebsiteItem>): Promise<void> {
  if (item.uuid && item.id) {
    // 更新
    await dbClient.execute(
      `UPDATE ${WEBSITES_TABLE_NAME} SET title = $1, url = $2, url_lan = $3, default_icon = $4, local_icon_path = $5, group_uuid = $6, sort_order = $7, description = $8, background_color = $9, icon_source = $10 WHERE uuid = $11`,
      [
        item.title,
        item.url,
        item.url_lan,
        item.default_icon,
        item.local_icon_path,
        item.group_uuid,
        item.sort_order,
        item.description,
        item.background_color,
        item.icon_source,
        item.uuid,
      ]
    );
  } else {
    // 新增
    if (!item.user_uuid) {
      const message = "新增网站项时必须提供 user_uuid！";
      log.error(message);
      throw new Error(message);
    }
    await dbClient.execute(
      `INSERT INTO ${WEBSITES_TABLE_NAME} (uuid, user_uuid, group_uuid, title, url, url_lan, default_icon, local_icon_path, sort_order, description, background_color, icon_source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        crypto.randomUUID(),
        item.user_uuid,
        item.group_uuid,
        item.title,
        item.url,
        item.url_lan,
        item.default_icon,
        item.local_icon_path,
        item.sort_order,
        item.description,
        item.background_color,
        item.icon_source,
      ]
    );
  }
}

/**
 * 批量更新网站项的排序。
 */
export async function updateItemsOrder(
  items: Pick<WebsiteItem, "uuid">[]
): Promise<void> {
  for (const [index, item] of items.entries()) {
    await dbClient.execute(
      `UPDATE ${WEBSITES_TABLE_NAME} SET sort_order = $1 WHERE uuid = $2`,
      [index + 1, item.uuid]
    );
  }
}

/**
 * 软删除一个网站项。
 */
export async function deleteItem(itemUuid: string): Promise<void> {
  await dbClient.execute(
    `UPDATE ${WEBSITES_TABLE_NAME} SET is_deleted = 1 WHERE uuid = $1`,
    [itemUuid]
  );
}

/**
 * 为指定用户插入默认的网站和分组数据。
 */
async function insertDefaultData(userUuid: string): Promise<void> {
  const username = await getUsernameByUuid(userUuid);
  log.warn(`正在为用户【${username}】插入默认数据...`);
  for (const group of defaultWebsiteData) {
    const groupUuid = crypto.randomUUID();
    await dbClient.execute(
      `INSERT INTO ${WEBSITE_GROUPS_TABLE_NAME} (uuid, user_uuid, name, sort_order, description) VALUES ($1, $2, $3, $4, $5)`,
      [groupUuid, userUuid, group.name, group.sort_order, group.description]
    );

    if (group.items && group.items.length > 0) {
      for (const item of group.items) {
        await dbClient.execute(
          `INSERT INTO ${WEBSITES_TABLE_NAME} (uuid, user_uuid, group_uuid, title, url, default_icon, sort_order, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            crypto.randomUUID(),
            userUuid,
            groupUuid,
            item.title,
            item.url,
            item.default_icon,
            item.sort_order,
            item.description,
          ]
        );
      }
    }
  }
}

// --- 搜索引擎数据库操作 ---

/**
 * 获取用户的所有自定义搜索引擎。
 */
export async function getSearchEngines(
  userUuid: string
): Promise<SearchEngine[]> {
  const customEngines = await dbClient.select<SearchEngine>(
    `SELECT *, 1 as is_deletable FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE user_uuid = $1 ORDER BY sort_order ASC, name ASC`,
    [userUuid]
  );
  return customEngines;
}

/**
 * 获取用户的默认搜索引擎。
 */
export async function getDefaultSearchEngine(
  userUuid: string
): Promise<SearchEngine | null> {
  const result = await dbClient.select<SearchEngine>(
    `SELECT *, 1 as is_deletable FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = 1`,
    [userUuid]
  );
  return result[0] || null;
}

/**
 * 保存（新增或更新）一个搜索引擎。
 */
export async function saveSearchEngine(
  engine: Partial<Omit<SearchEngine, "id" | "is_deletable">> & {
    user_uuid: string;
  }
): Promise<void> {
  if (engine.uuid) {
    // 更新操作
    await dbClient.execute(
      `UPDATE ${SEARCH_ENGINES_TABLE_NAME} SET name = $1, url_template = $2, local_icon_path = $3 WHERE uuid = $4 AND user_uuid = $5`,
      [
        engine.name,
        engine.url_template,
        engine.local_icon_path,
        engine.uuid,
        engine.user_uuid,
      ]
    );
  } else {
    // 新增操作
    await dbClient.execute(
      `INSERT INTO ${SEARCH_ENGINES_TABLE_NAME} (uuid, user_uuid, name, url_template, default_icon, local_icon_path, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        crypto.randomUUID(),
        engine.user_uuid,
        engine.name,
        engine.url_template,
        engine.default_icon,
        engine.local_icon_path,
        0,
      ]
    );
  }
}

/**
 * 设置用户的默认搜索引擎。
 */
export async function setActiveSearchEngine(
  engineUuid: string,
  userUuid: string
): Promise<void> {
  // 事务：先将所有引擎设为非默认，再将选定的设为默认
  await dbClient.execute(
    `UPDATE ${SEARCH_ENGINES_TABLE_NAME} SET is_default = 0 WHERE user_uuid = $1`,
    [userUuid]
  );
  await dbClient.execute(
    `UPDATE ${SEARCH_ENGINES_TABLE_NAME} SET is_default = 1 WHERE user_uuid = $1 AND uuid = $2`,
    [userUuid, engineUuid]
  );
}

/**
 * 清除用户的默认搜索引擎设置。
 */
export async function clearDefaultSearchEngine(
  userUuid: string
): Promise<void> {
  await dbClient.execute(
    `UPDATE ${SEARCH_ENGINES_TABLE_NAME} SET is_default = 0 WHERE user_uuid = $1`,
    [userUuid]
  );
}

/**
 * 删除一个自定义搜索引擎。
 */
export async function deleteSearchEngine(uuid: string): Promise<void> {
  await dbClient.execute(
    `DELETE FROM ${SEARCH_ENGINES_TABLE_NAME} WHERE uuid = $1`,
    [uuid]
  );
}
