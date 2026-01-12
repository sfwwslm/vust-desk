import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import {
  getPanelEnvironment,
  setPanelEnvironment,
  Environment,
} from "@/utils/config";

type EnvironmentContextType = {
  environment: Environment;
  toggleEnvironment: () => void;
};

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(
  undefined,
);

export const EnvironmentProvider = ({ children }: { children: ReactNode }) => {
  const [environment, setEnvironment] = useState<Environment>("lan");

  // 在组件挂载时从配置文件异步加载初始状态
  useEffect(() => {
    const loadEnvironment = async () => {
      const savedEnv = await getPanelEnvironment();
      setEnvironment(savedEnv);
    };
    loadEnvironment();
  }, []);

  const toggleEnvironment = async () => {
    const newEnv = environment === "lan" ? "wan" : "lan";
    setEnvironment(newEnv); // 立即更新UI状态
    await setPanelEnvironment(newEnv); // 将新状态写入配置文件
  };

  return (
    <EnvironmentContext.Provider value={{ environment, toggleEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error(
      "useEnvironment must be used within an EnvironmentProvider",
    );
  }
  return context;
};
