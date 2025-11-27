import { dbClient } from "./db";
import { Asset, AssetCategory } from "@/features/Assets/types";
import { ANONYMOUS_USER_UUID } from "@/services/user";
import { ASSET_TABLE_NAME, ASSET_CATEGORIES_TABLE_NAME } from "@/constants";

/**
 * @function getDefaultCategory
 * @description 获取用户的默认资产分类。
 * @returns {Promise<AssetCategory>} 返回默认分类对象。
 */
export async function getDefaultCategory(
  activeUuid: string
): Promise<AssetCategory> {
  // 通过 is_default 标志查找默认分类
  const result = await dbClient.select<AssetCategory>(
    `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_default = 1 AND is_deleted = 0`,
    [activeUuid]
  );

  const category = result[0];
  if (!category) {
    // 理论上不应该发生，因为 db.ts 中已经确保了它的存在
    throw new Error("严重错误：默认分类不存在！");
  }
  return category;
}

/**
 * 获取当前用户所有未被软删除的资产
 * @returns {Promise<Asset[]>}
 */
export async function getAssetsData(activeUuid: string): Promise<Asset[]> {
  const assets = dbClient.select<Asset>(
    `
    SELECT
      a.*,
      ac.name as category_name,
      ac.is_default as category_is_default
    FROM ${ASSET_TABLE_NAME} a
    LEFT JOIN ${ASSET_CATEGORIES_TABLE_NAME} ac ON a.category_uuid = ac.uuid
    WHERE a.is_deleted = 0 AND a.user_uuid = $1 AND ac.user_uuid = $1
    ORDER BY a.purchase_date DESC
    `,
    [activeUuid]
  );

  return await assets;
}

/**
 * 检查具有给定UUID的资产是否存在且未被软删除。
 * @param {string} uuid - 资产的UUID。
 * @returns {Promise<boolean>} 如果存在则返回true，否则返回false。
 */
export async function assetExists(uuid: string): Promise<boolean> {
  const result = await dbClient.select<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${ASSET_TABLE_NAME} WHERE uuid = $1 AND is_deleted = 0`,
    [uuid]
  );
  return result.length > 0 && result[0].count > 0;
}

/**
 * 保存（新增或更新）一个资产。
 * @param {Partial<Asset>} asset - 包含资产数据的对象。
 */
export async function saveAsset(asset: Partial<Asset>): Promise<void> {
  if (asset.uuid && (await assetExists(asset.uuid))) {
    // 更新操作
    const updateQuery = `UPDATE ${ASSET_TABLE_NAME} SET name = $1, purchase_date = $2, price = $3, category_uuid = $4, expiration_date = $5, description = $6, user_uuid = $7, brand = $8, model = $9, serial_number = $10 WHERE uuid = $11`;
    await dbClient.execute(updateQuery, [
      asset.name,
      asset.purchase_date,
      asset.price,
      asset.category_uuid,
      asset.expiration_date || null,
      asset.description || null,
      asset.user_uuid,
      asset.brand || null,
      asset.model || null,
      asset.serial_number || null,
      asset.uuid,
    ]);
  } else {
    // 新增操作
    const insertQuery = `INSERT INTO ${ASSET_TABLE_NAME} (uuid, user_uuid, name, purchase_date, price, category_uuid, expiration_date, description, brand, model, serial_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;
    await dbClient.execute(insertQuery, [
      crypto.randomUUID(),
      asset.user_uuid,
      asset.name,
      asset.purchase_date,
      asset.price,
      asset.category_uuid,
      asset.expiration_date || null,
      asset.description || null,
      asset.brand || null,
      asset.model || null,
      asset.serial_number || null,
    ]);
  }
}

/**
 * 软删除一个资产分类，并将其下的所有资产重新分配到"默认分类"类别。
 * @param {string} uuid - 要删除的分类的UUID。
 */
export async function deleteCategory(uuid: string): Promise<void> {
  const categoryToDelete = await dbClient.select<AssetCategory>(
    `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE uuid = $1`,
    [uuid]
  );

  // 防止删除默认分类
  if (categoryToDelete[0] && categoryToDelete[0].is_default === 1) {
    throw new Error("无法删除默认分类。");
  }

  await dbClient.execute(
    `UPDATE ${ASSET_TABLE_NAME} SET category_uuid = $1 WHERE category_uuid = $2`,
    [ANONYMOUS_USER_UUID, uuid]
  );

  await dbClient.execute(
    `UPDATE ${ASSET_CATEGORIES_TABLE_NAME} SET is_deleted = 1 WHERE uuid = $1`,
    [uuid]
  );
}

/**
 * 获取当前用户的所有未删除的资产分类。
 * @returns {Promise<AssetCategory[]>}
 */
export async function getAllCategories(
  activeUuid: string
): Promise<AssetCategory[]> {
  const categories = await dbClient.select<AssetCategory>(
    `SELECT * FROM ${ASSET_CATEGORIES_TABLE_NAME} WHERE user_uuid = $1 AND is_deleted = 0 ORDER BY name ASC`,
    [activeUuid]
  );

  // 将默认分类置顶
  categories.sort((a, b) => {
    // 如果 a 是默认分类，它应该排在前面
    if (a.is_default === 1 && b.is_default !== 1) {
      return -1;
    }
    // 如果 b 是默认分类，它应该排在前面
    if (b.is_default === 1 && a.is_default !== 1) {
      return 1;
    }
    // 对于其他非默认分类，保持它们之间的字母顺序
    return a.name.localeCompare(b.name);
  });

  return categories;
}

/**
 * 保存（新增或更新）一个资产分类。
 * @param {Partial<AssetCategory>} category - 分类数据。
 */
export async function saveCategory(
  category: Partial<AssetCategory>
): Promise<void> {
  if (category.uuid) {
    // 更新
    await dbClient.execute(
      `UPDATE ${ASSET_CATEGORIES_TABLE_NAME} SET name = $1 WHERE uuid = $2 AND user_uuid = $3`,
      [category.name, category.uuid, category.user_uuid]
    );
  } else {
    // 新增
    await dbClient.execute(
      `INSERT INTO ${ASSET_CATEGORIES_TABLE_NAME} (uuid, user_uuid, name) VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), category.user_uuid, category.name]
    );
  }
}

/**
 * 软删除一个资产。
 * @param {string} uuid - 要删除的资产的UUID。
 */
export async function deleteAsset(uuid: string): Promise<void> {
  await dbClient.execute(
    `UPDATE ${ASSET_TABLE_NAME} SET is_deleted = 1 WHERE uuid = $1`,
    [uuid]
  );
}
