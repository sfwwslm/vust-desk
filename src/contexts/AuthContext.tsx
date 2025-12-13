import {
  createContext,
  useCallback,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import * as log from "@tauri-apps/plugin-log";

import useLocalStorage from "@/hooks/useLocalStorage";
import { saveUser } from "@/services/db";
import {
  User,
  ANONYMOUS_USER_UUID,
  ANONYMOUS_USER,
  setUserLoginStatus,
  getAllUsers,
  updateUserServerAddress,
  deleteUserWithData,
} from "@/services/user";
import { apiClientWrapper } from "@/services/apiClient";
import { ApiError, HttpError } from "@/services/errors";
import { Claims, loginResponse } from "@/types/session";

function parseJwt(token: string): Claims | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    log.error(`JWT 解析失败: ${error}`);
    return null;
  }
}

/**
 * @interface AuthContextType
 * @description 定义了 AuthContext 的数据结构和可供消费的 API。
 * 这个 Context 是整个应用中用户认证和状态管理的核心。
 */
interface AuthContextType {
  /**
   * @property {User | null} activeUser
   * @description 当前正在操作的用户对象。
   * - 它的值决定了应用当前显示的是哪个用户的数据（例如，导航面板、资产列表等）。
   * - 如果用户未登录或已登出，它的值会是代表“匿名用户”的对象。
   * - 在应用启动时，会从 localStorage 加载上一次的用户状态。
   */
  activeUser: User | null;

  /**
   * @property {User[]} availableUsers
   * @description 一个包含所有已登录（is_logged_in = 1）用户的数组。
   * - 这个列表用于在“设置”页面的用户切换下拉菜单中展示可用的用户选项。
   */
  availableUsers: User[];

  /**
   * @property {boolean} isLoggedIn
   * @description 一个便捷的布尔值标志，用于快速判断当前 `activeUser` 是否为已认证的登录用户。
   * - `true` 表示当前用户已登录到服务器。
   * - `false` 表示当前为匿名用户状态。
   * - 它的值是根据 `activeUser.isLoggedIn` 属性动态计算的。
   */
  isLoggedIn: boolean;

  /**
   * @function login
   * @description 登录函数，用于向服务器验证用户凭据。
   * @param {string} username - 用户名。
   * @param {string} password - 密码。
   * @param {string} address - 服务器地址 (例如 "127.0.0.1:9990")。
   * @param {boolean} useHttps - 是否使用 HTTPS。
   * @returns {Promise<void>} 一个在登录流程完成后解析的 Promise。
   */
  login: (
    username: string,
    password: string,
    address: string,
    useHttps: boolean
  ) => Promise<void>;

  /**
   * @function logout
   * @description 登出当前活动用户的函数。
   * - 这是一个便捷操作，内部会调用 `logoutUser` 并传入当前用户的 UUID。
   */
  logout: () => void;

  /**
   * @function logoutUser
   * @description 登出指定 UUID 的用户，使其变为离线状态。
   * - 与 `logout()` 不同，此函数可以登出非当前活动的用户（例如在账户切换列表中）。
   * - 将指定用户的 is_logged_in 状态在数据库中更新为 0。
   * - 如果被登出的用户是当前活动用户，则将 activeUser 切换回匿名用户。
   * @param {string} uuid - 要登出的用户的 UUID。
   */
  logoutUser: (uuid: string) => void;

  /**
   * @function switchActiveUser
   * @description 切换当前活动用户的函数。
   * @param {User} user - 要切换到的目标用户对象。
   */
  switchActiveUser: (user: User) => void;

  /**
   * @function deleteUser
   * @description 从本地删除指定用户及其数据。
   */
  deleteUser: (uuid: string) => Promise<void>;

  /**
   * @property {boolean} isDataOperationInProgress
   * @description 全局“锁”状态，用于防止数据库并发访问冲突（死锁）。
   * - `true` 表示一个数据密集型、事务性的操作（如“数据认领”、“数据同步”）正在进行中。
   * - 当它为 `true` 时，其他组件（如 AssetDashboard）应该暂停执行数据库读取操作，以避免冲突。
   * - `false` 表示当前没有此类操作，数据库可以安全访问。
   */
  isDataOperationInProgress: boolean;

  /**
   * @property {number} dataVersion
   * @description 一个数字版本号，充当全局“刷新信号”。
   * - 当一个操作（如“数据认领”）成功完成并显著改变了数据库的数据归属后，这个版本号会递增。
   * - 监听此值的组件（如 AssetDashboard, PanelPage）会在其变化时自动重新加载数据，确保UI与数据库同步。
   */
  dataVersion: number;

  /**
   * @function setDataOperationInProgress
   * @description 设置全局“锁”状态的函数。
   * @param {boolean} inProgress - `true` 表示开始一个密集操作，`false` 表示操作已结束。
   */
  setDataOperationInProgress: (inProgress: boolean) => void;

  /**
   * @function incrementDataVersion
   * @description 递增 `dataVersion` 的函数，用于在数据更新后广播“刷新信号”。
   */
  incrementDataVersion: () => void;

  /**
   * @function refreshAvailableUsers
   * @description 强制刷新可用的用户列表。
   */
  refreshAvailableUsers: () => Promise<User[]>;

  /**
   * @function updateServerAddress
   * @description 更新当前激活用户的服务器地址。
   */
  updateServerAddress: (serverAddress: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [activeUser, setActiveUser] = useLocalStorage<User | null>(
    "activeUser",
    {
      uuid: ANONYMOUS_USER_UUID,
      username: ANONYMOUS_USER,
      isLoggedIn: 1, // 匿名用户始终在本地“登录”
    }
  );
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // 用于全局锁定数据库操作
  const [isDataOperationInProgress, setDataOperationInProgress] =
    useState(false);
  // 用于在数据变更后触发UI刷新
  const [dataVersion, setDataVersion] = useState(0);

  /**
   * @function incrementDataVersion
   * @description 递增数据版本号，通知组件刷新
   */
  const incrementDataVersion = useCallback(() => {
    setDataVersion((v) => v + 1);
    log.info("数据版本号已更新，将触发相关组件的数据刷新。");
  }, []);

  const refreshAvailableUsers = useCallback(async () => {
    const users = await getAllUsers();
    setAvailableUsers(users);
    return users;
  }, []);

  useEffect(() => {
    refreshAvailableUsers();
  }, [refreshAvailableUsers]);

  /** 切换用户 */
  const switchActiveUser = useCallback(
    (user: User) => {
      setActiveUser(user);
      log.info(`已切换当前用户为: ${user.username}`);
    },
    [setActiveUser]
  );

  const login = useCallback(
    async (
      username: string,
      password: string,
      address: string,
      useHttps: boolean
    ) => {
      try {
        let protocol = useHttps ? "https" : "http";
        let serverAddress = `${protocol}://${address}`;
        const res: loginResponse = await apiClientWrapper.post(
          "/api/login",
          {
            username,
            password,
          },
          {
            baseUrl: serverAddress,
          }
        );

        const claims = parseJwt(res.accessToken);
        if (!claims) throw new Error("无法解析Token。");

        const newUser: User = {
          uuid: claims.sub,
          username: claims.username,
          serverAddress: useHttps ? `https://${address}` : `http://${address}`,
          serverInstanceUuid: claims.iss,
          isLoggedIn: 1, // 标记为已登录
          token: res.accessToken,
        };

        await saveUser(newUser);
        await setUserLoginStatus(newUser.uuid, true);

        // 登录成功后，立即将新用户设置为活动用户
        await refreshAvailableUsers();
        switchActiveUser(newUser);

        log.info(`登录成功，用户: ${newUser.username}`);
      } catch (error: ApiError | any) {
        log.error(`登录失败，错误信息: ${error.toString()}`);
        if (error instanceof HttpError) {
          if (typeof error.responseBody === "object") {
            for (const key in error.responseBody) {
              if (key === "message") {
                throw new Error(error.responseBody[key]);
              }
            }
            throw new Error(JSON.stringify(error.responseBody));
          } else {
            throw new Error(error.responseBody);
          }
        } else if (error instanceof ApiError) {
          throw new Error(error.toString());
        } else {
          throw error;
        }
      }
    },
    [switchActiveUser, refreshAvailableUsers]
  );

  const logoutUser = useCallback(
    // 退出账户逻辑
    async (uuid: string) => {
      await setUserLoginStatus(uuid, false);
      const refreshedUsers = await refreshAvailableUsers();
      if (activeUser?.uuid === uuid) {
        const anonymousUser = refreshedUsers.find(
          (u) => u.uuid === ANONYMOUS_USER_UUID
        );
        if (anonymousUser) {
          switchActiveUser(anonymousUser);
        }
      }
      log.info(`用户 ${uuid} 已被登出。`);
    },
    [activeUser, refreshAvailableUsers, switchActiveUser]
  );

  const logout = useCallback(async () => {
    if (activeUser && activeUser.isLoggedIn) {
      await logoutUser(activeUser.uuid);
    }
  }, [activeUser, logoutUser]);

  const deleteUser = useCallback(
    async (uuid: string) => {
      await deleteUserWithData(uuid);
      const refreshedUsers = await refreshAvailableUsers();

      if (activeUser?.uuid === uuid) {
        const anonymousUser =
          refreshedUsers.find((u) => u.uuid === ANONYMOUS_USER_UUID) || {
            uuid: ANONYMOUS_USER_UUID,
            username: ANONYMOUS_USER,
            isLoggedIn: 1,
          };
        switchActiveUser(anonymousUser);
      }

      incrementDataVersion();
      log.info(`用户 ${uuid} 及其本地数据已被删除。`);
    },
    [
      activeUser,
      incrementDataVersion,
      refreshAvailableUsers,
      switchActiveUser,
    ]
  );

  const updateServerAddress = useCallback(
    async (serverAddress: string) => {
      if (!activeUser) {
        return;
      }
      const trimmedAddress = serverAddress.trim();
      await updateUserServerAddress(activeUser.uuid, trimmedAddress);
      setActiveUser((prev) =>
        prev && prev.uuid === activeUser.uuid
          ? { ...prev, serverAddress: trimmedAddress }
          : prev
      );
      setAvailableUsers((prev) =>
        prev.map((user) =>
          user.uuid === activeUser.uuid
            ? { ...user, serverAddress: trimmedAddress }
            : user
        )
      );
      log.info(
        `用户 ${activeUser.username} (${activeUser.uuid}) 的服务器地址已更新。`
      );
    },
    [activeUser, setActiveUser, setAvailableUsers]
  );

  return (
    <AuthContext.Provider
      value={{
        activeUser,
        availableUsers,
        isLoggedIn: !!activeUser && activeUser.isLoggedIn === 1,
        login,
        logout,
        logoutUser,
        switchActiveUser,
        deleteUser,
        isDataOperationInProgress,
        dataVersion,
        setDataOperationInProgress,
        incrementDataVersion,
        refreshAvailableUsers,
        updateServerAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 中使用");
  }
  return context;
};
