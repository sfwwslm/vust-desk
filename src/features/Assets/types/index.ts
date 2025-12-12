/**
 * @interface AssetCategory
 * @description 定义资产分类数据结构
 */
export interface AssetCategory {
  /**
   * 数据库自增 ID。
   */
  id: number;
  /**
   * 全局唯一标识符 (Universally Unique Identifier)。
   */
  uuid: string;
  /**
   * 用户的 UUID。
   */
  user_uuid: string;
  /**
   * 分类名称
   */
  name: string;
  /**
   * 是否为默认分类的标志 (1: 是, 0: 否)。
   * @description 新增
   */
  is_default: number;
}

/**
 * @interface Asset
 * @description 定义资产数据结构
 */
export interface Asset {
  /**
   * 数据库自增 ID。
   */
  id: number;
  /**
   * 全局唯一标识符 (Universally Unique Identifier)。
   * 用于跨设备、跨环境同步。
   */
  uuid: string;
  /**
   * 用户的 UUID。
   */
  user_uuid: string;
  /**
   * 资产名称，例如 "iPhone 15 Pro"。
   */
  name: string;
  /**
   * 资产品牌。
   */
  brand?: string;
  /**
   * 资产型号。
   */
  model?: string;
  /**
   * 资产序列号。
   */
  serial_number?: string;
  /**
   * 购买日期，格式为 'YYYY-MM-DD'，例如 "2023-05-01"。
   */
  purchase_date: string;
  /**
   * 购买价格，支持小数，单位为人民币（￥）。
   */
  price: number;
  /**
   * 资产分类的 UUID
   */
  category_uuid: string;
  /**
   * 资产分类的名称 (通常通过 JOIN 查询获得)
   */
  category_name?: string;
  /**
   * 资产分类的是否为默认分类的标志 (通过 JOIN 查询获得)
   * @description 新增
   */
  category_is_default?: number;
  /**
   * 资产的过期日期，可选。格式为 'YYYY-MM-DD'。
   * 如果资产永不过期，可以不填写此字段。
   */
  expiration_date?: string;
  /**
   * 资产的详细描述，可选。
   * 可以包含资产的型号、配置、状态等额外信息。
   */
  description?: string;
  /**
   * 持有状态：holding（持有中）/ sold（已卖出）/ archived 等扩展值。
   */
  status: string;
  /**
   * 卖出价格，可选。
   */
  sale_price?: number | null;
  /**
   * 卖出日期，可选。
   */
  sale_date?: string | null;
  /**
   * 卖出产生的费用，可选。
   */
  fees?: number | null;
  /**
   * 买家信息备注。
   */
  buyer?: string | null;
  /**
   * 卖出备注。
   */
  notes?: string | null;
  /**
   * 已实现收益（卖出价 - 成本 - 费用）。
   */
  realized_profit?: number | null;
  /**
   * 软删除标志。
   * 0 表示未删除，1 表示已删除。
   */
  is_deleted: number;
  /**
   * 资产的入库时间戳，由数据库自动生成。
   * 格式为 'YYYY-MM-DD HH:MM:SS.SSS' (本地时间)。
   * 此字段不通过前端输入，仅用于显示和记录。
   */
  created_at?: string;
  /**
   * 资产记录的最后更新时间戳，由数据库自动更新。
   */
  updated_at?: string;
}

/**
 * @interface ModalProps
 * @description 定义模态框组件的props
 */
export interface ModalProps {
  isOpen: boolean; // 控制模态框的显示/隐藏
  onClose: () => void; // 关闭模态框的回调函数
  children: React.ReactNode;
  title?: string;
}
