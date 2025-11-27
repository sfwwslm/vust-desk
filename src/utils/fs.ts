import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";
import { info, debug } from "@tauri-apps/plugin-log";
import { HOME_VUST_DIR, APP_CONFIG_DIR, APP_DATA_DIR } from "@/constants";

/**
 * 获取应用配置目录的路径 (~/.vust/vust-desk)
 */
export async function getAppConfigDir() {
  return await join(await homeDir(), HOME_VUST_DIR, APP_CONFIG_DIR);
}

/**
 * 获取应用图标目录的路径
 */
export async function getIconsDir() {
  return await join(await getAppConfigDir(), "icons");
}

/**
 * 数据库目录
 *
 * 家目录中的`.vust/vust-desk/data`文件夹
 */
export async function dbDir() {
  const dir = await join(await getAppConfigDir(), APP_DATA_DIR);

  if (!(await exists(dir, { baseDir: BaseDirectory.Home }))) {
    debug("数据库目录不存在，正在创建...");
    await mkdir(dir, {
      baseDir: BaseDirectory.Home,
      recursive: true,
    });
    debug(`成功创建：${dir}`);
  } else {
    debug(`数据库目录已存在不需要创建：${dir}`);
  }
  return dir;
}

/**
 * @function ensureAppRootDirExists
 * @description 确保应用在用户主目录下的根文件夹 (.vust) 已创建。
 *
 * 这个函数是幂等的：如果文件夹已存在，它不会执行任何操作；如果不存在，则会递归创建。
 *
 * 这是应用启动时应首先调用的初始化函数之一，以保证后续操作（如数据库、日志、配置文件的读写）有正确的目录基础。
 */
export async function ensureAppRootDirExists(): Promise<void> {
  const dir = await getAppConfigDir();
  if (!(await exists(dir, { baseDir: BaseDirectory.Home }))) {
    info(`应用根目录不存在，正在创建: ${dir}`);
    await mkdir(dir, {
      baseDir: BaseDirectory.Home,
      recursive: true,
    });
  }
}
