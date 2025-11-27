import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import * as log from "@tauri-apps/plugin-log";
import { getIconsDir } from "@/utils/fs";
import { getActiveUserFromStorage } from "./user";

/**
 * 将指定的图标文件上传到服务器。
 *
 * @param iconsToUpload - 需要上传的图标文件名数组。
 * @returns {Promise<void>}
 * @description 此函数会遍历文件名列表，并为每个文件调用后端的 `upload_icon` Tauri 命令。
 */
export async function uploadIcons(iconsToUpload: string[]): Promise<void> {
  const activeUser = getActiveUserFromStorage();
  if (!activeUser?.token || !activeUser.serverAddress) {
    log.warn("无法上传图标：用户未登录或服务器地址无效。");
    return;
  }

  const iconsDir = await getIconsDir();

  for (const filename of iconsToUpload) {
    try {
      const filePath = await join(iconsDir, filename);
      // 调用 Rust 后端命令来处理上传
      await invoke("upload_icon", {
        user: activeUser,
        filePath: filePath,
        fileName: filename,
      });
      log.info(`✅ 图标上传任务已发送到后端: ${filename}`);
    } catch (error) {
      log.error(`❌ 调用图标上传命令失败: ${filename}。错误: ${error}`);
    }
  }
}

/**
 * 从服务器下载指定的图标文件。
 *
 * @param iconsToDownload - 需要下载的图标文件名数组。
 * @returns {Promise<void>}
 * @description 此函数会遍历文件名列表，并为每个文件调用后端的 `download_icon` Tauri 命令。
 */
export async function downloadIcons(iconsToDownload: string[]): Promise<void> {
  const activeUser = getActiveUserFromStorage();
  if (!activeUser?.token || !activeUser.serverAddress) {
    log.warn("无法下载图标：用户未登录或服务器地址无效。");
    return;
  }

  for (const filename of iconsToDownload) {
    try {
      // 调用 Rust 后端命令来处理下载
      await invoke("download_icon", {
        user: activeUser,
        fileName: filename,
      });
      log.info(`✅ 图标下载任务已发送到后端: ${filename}`);
    } catch (error) {
      log.error(`❌ 调用图标下载命令失败: ${filename}。错误: ${error}`);
    }
  }
}
