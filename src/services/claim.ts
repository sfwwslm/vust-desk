import { dbClient, getDb } from "@/services/db";
import * as log from "@tauri-apps/plugin-log";
import { ANONYMOUS_USER_UUID } from "@/services/user";
import {
  WEBSITE_GROUPS_TABLE_NAME,
  WEBSITES_TABLE_NAME,
  ASSET_CATEGORIES_TABLE_NAME,
  ASSET_TABLE_NAME,
} from "@/constants";
import { User } from "./user";

/**
 * @function hasAnonymousData
 * @description 检查是否存在未被删除的资产。
 * @returns {Promise<boolean>} 如果存在匿名数据，则返回 true，否则返回 false。
 */
export const hasAnonymousData = async (): Promise<boolean> => {
  const assets = await dbClient.select<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${ASSET_TABLE_NAME} WHERE is_deleted = 0`,
  );

  // **类型修正**: 先获取第一个元素，再安全地访问其属性。
  const firstAsset = assets[0];
  return firstAsset ? firstAsset.count > 0 : false;
};

// 假设的 DTO 类型，为了代码清晰
interface AssetCategoryDto {
  uuid: string;
  name: string;
  is_default: number;
}
interface WebsiteGroupDto {
  uuid: string;
  name: string;
}

/**
 * @function reassignAnonymousDataToUser
 * @description 将所有匿名数据的所有权重新分配给指定的用户，并智能处理冲突。
 * 此最终版本正确处理了匿名默认分类的保留逻辑。
 * @param {User} user - 当前登录的用户对象。
 */
export const reassignAnonymousDataToUser = async (
  user: User,
): Promise<void> => {
  // 使用一个独立的数据库连接来管理整个事务
  const db = await getDb();
  const realUserUuid = user.uuid;

  log.info(
    `[数据认领] 用户 "${user.username}" (${user.uuid}) 开始认领匿名数据...`,
  );

  try {
    // --- 1. 获取所有匿名数据和真实用户数据以供对比 ---
    const anonymousCategories = await db.select<AssetCategoryDto[]>(
      `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = ?`,
      [ANONYMOUS_USER_UUID],
    );
    const userCategories = await db.select<AssetCategoryDto[]>(
      `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = ?`,
      [realUserUuid],
    );

    const anonymousGroups = await db.select<WebsiteGroupDto[]>(
      `SELECT * FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = ?`,
      [ANONYMOUS_USER_UUID],
    );
    const userGroups = await db.select<WebsiteGroupDto[]>(
      `SELECT * FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE user_uuid = ?`,
      [realUserUuid],
    );

    // --- 2. 智能合并资产分类 ---
    const userDefaultCategory = userCategories.find((c) => c.is_default === 1);
    if (!userDefaultCategory) {
      throw new Error(`严重错误：真实用户 ${realUserUuid} 没有默认分类！`);
    }

    for (const anonCategory of anonymousCategories) {
      // 关键修复：正确处理匿名用户的“默认分类”
      if (anonCategory.is_default === 1) {
        log.info(
          `[资产分类] ➡️ 正在处理匿名的“默认分类” (${anonCategory.uuid})...`,
        );

        // 步骤 2.1: 只迁移属于该分类的资产，不删除分类本身！
        // 把默认分类的资产迁移到真实用户的默认分类下
        const migrationResult = await db.execute(
          `UPDATE ${ASSET_TABLE_NAME} SET category_uuid = ?, user_uuid = ? WHERE category_uuid = ? AND user_uuid = ?`,
          [
            userDefaultCategory.uuid,
            realUserUuid,
            anonCategory.uuid,
            ANONYMOUS_USER_UUID,
          ],
        );

        if (migrationResult.rowsAffected > 0) {
          log.info(
            `[资产分类] ✅ 匿名“默认分类”下的 ${migrationResult.rowsAffected} 条资产已完成所有权和分类迁移。`,
          );
        } else {
          log.info(`[资产分类] ℹ️ 匿名“默认分类”下没有需要迁移的资产。`);
        }
        continue;
      }

      // 对于非默认的匿名分类，采用之前的合并/认领逻辑
      const conflict = userCategories.find((c) => c.name === anonCategory.name);
      if (conflict) {
        log.warn(
          `[资产分类] ⚠️ 发现同名分类冲突: "${anonCategory.name}"。正在合并...`,
        );
        await db.execute(
          `UPDATE ${ASSET_TABLE_NAME} SET category_uuid = ?, user_uuid = ? WHERE category_uuid = ?`,
          [conflict.uuid, realUserUuid, anonCategory.uuid],
        );
        await db.execute(
          `DELETE FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE uuid = ?`,
          [anonCategory.uuid],
        );
        log.info(`[资产分类] ✅ 分类 "${anonCategory.name}" 下的资产已合并。`);
      } else {
        await db.execute(
          `UPDATE ${ASSET_CATEGORIES_TABLE_NAME} SET user_uuid = ? WHERE uuid = ?`,
          [realUserUuid, anonCategory.uuid],
        );
      }
    }
    log.info(`[资产分类] ✅ 所有资产分类已处理完毕。`);

    // --- 3. 智能合并网站分组 (逻辑不变) ---
    for (const anonGroup of anonymousGroups) {
      const conflict = userGroups.find((g) => g.name === anonGroup.name);
      if (conflict) {
        log.warn(
          `[网站分组] ⚠️ 发现同名分组冲突: "${anonGroup.name}"。正在合并...`,
        );
        await db.execute(
          `UPDATE ${WEBSITES_TABLE_NAME} SET group_uuid = ?, user_uuid = ? WHERE group_uuid = ?`,
          [conflict.uuid, realUserUuid, anonGroup.uuid],
        );
        await db.execute(
          `DELETE FROM ${WEBSITE_GROUPS_TABLE_NAME} WHERE uuid = ?`,
          [anonGroup.uuid],
        );
        log.info(`[网站分组] ✅ 分组 "${anonGroup.name}" 下的网站已合并。`);
      } else {
        await db.execute(
          `UPDATE ${WEBSITE_GROUPS_TABLE_NAME} SET user_uuid = ? WHERE uuid = ?`,
          [realUserUuid, anonGroup.uuid],
        );
      }
    }
    log.info(`[网站分组] ✅ 所有网站分组已处理完毕。`);

    // --- 4. 认领所有剩余的、未被合并处理的记录 ---
    const remainingAssets = await db.execute(
      `UPDATE ${ASSET_TABLE_NAME} SET user_uuid = ? WHERE user_uuid = ?`,
      [realUserUuid, ANONYMOUS_USER_UUID],
    );
    if (remainingAssets.rowsAffected > 0) {
      log.info(
        `[资产认领] ✅ ${remainingAssets.rowsAffected} 条匿名资产已完成所有权分配。`,
      );
    }

    const remainingWebsites = await db.execute(
      `UPDATE ${WEBSITES_TABLE_NAME} SET user_uuid = ? WHERE user_uuid = ?`,
      [realUserUuid, ANONYMOUS_USER_UUID],
    );
    if (remainingWebsites.rowsAffected > 0) {
      log.info(
        `[站点认领] ✅ ${remainingWebsites.rowsAffected} 个剩余站点已完成所有权分配。`,
      );
    }

    log.info("[数据认领] ✔️✔️✔️ 匿名数据认领全部完成！");
  } catch (error) {
    log.error(`[数据认领] ❌ 在认领过程中发生错误: ${error}`);
    throw error;
  }
};
