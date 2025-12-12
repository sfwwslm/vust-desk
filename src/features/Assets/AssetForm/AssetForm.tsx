import React, { useState, useEffect } from "react";
import {
  Form,
  FormGroup,
  Label,
  Input,
  Textarea,
  ErrorMessage,
  SubmitButton,
} from "./AssetForm.styles";
import { Asset, AssetCategory } from "@/features/Assets/types";
import { isBefore, parseISO, isAfter } from "date-fns";
import {
  getCurrentDateFormatted,
  getDateTenYearsLaterFormatted,
} from "@/utils";
import { useTranslation } from "react-i18next";
import CustomSelect from "@/components/common/CustomSelect/CustomSelect";
import * as assetDb from "@/services/assetDb";
import { useAuth } from "@/contexts/AuthContext";

interface AssetFormProps {
  initialData?: Asset | null;
  onSubmit: (asset: Partial<Asset>) => void;
}

// 允许在表单状态中，price/sale_price/fees 临时为字符串
type FormAssetState = Partial<Omit<Asset, "price" | "sale_price" | "fees">> & {
  price?: number | string;
  sale_price?: number | string | null;
  fees?: number | string | null;
};

/**
 * @component AssetForm
 * @description 用于新增或编辑资产的表单，包含输入验证和默认值处理。
 */
const AssetForm: React.FC<AssetFormProps> = ({ initialData, onSubmit }) => {
  const { t } = useTranslation();
  const [asset, setAsset] = useState<FormAssetState>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const { activeUser } = useAuth();
  const [markAsSold, setMarkAsSold] = useState(false);

  // 加载分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      if (!activeUser?.uuid) return;
      const cats = await assetDb.getAllCategories(activeUser?.uuid);
      setCategories(cats);
      setIsLoadingCategories(false);
    };
    fetchCategories();
  }, [activeUser]);

  // 当 initialData 变化时（即模态框打开或编辑对象变化时），初始化表单
  useEffect(() => {
    // 仅当分类加载完毕后才进行初始化
    if (!isLoadingCategories) {
      if (initialData) {
        // 编辑模式：使用传入的完整数据
        setAsset({
          ...initialData,
          status: initialData.status || "holding",
        });
        setMarkAsSold(initialData.status === "sold");
      } else {
        // 新增模式：设置表单字段的默认值
        setAsset({
          name: "",
          purchase_date: getCurrentDateFormatted(),
          price: 0,
          category_uuid: categories.length > 0 ? categories[0].uuid : "", // 默认选中第一个分类
          expiration_date: getDateTenYearsLaterFormatted(),
          description: "",
          status: "holding",
          sale_price: null,
          sale_date: null,
          fees: 0,
          buyer: "",
          notes: "",
          realized_profit: null,
        });
        setMarkAsSold(false);
      }
    }
    // 每次重新初始化时清空错误
    setErrors({});
  }, [initialData, categories, isLoadingCategories, activeUser]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setAsset((prevAsset) => ({
      ...prevAsset,
      [name]: value, // 直接将输入值（字符串）存入状态
    }));

    if (errors[name]) {
      setErrors((prevErrors) => ({ ...prevErrors, [name]: "" }));
    }
  };

  /**
   * @function handleCategoryChange
   * @description 处理自定义选择框的回调
   * @param {string | number} value - the new category uuid
   */
  const handleCategoryChange = (value: string | number) => {
    setAsset((prevAsset) => ({
      ...prevAsset,
      category_uuid: value as string,
    }));
    if (errors.category_uuid) {
      setErrors((prevErrors) => ({ ...prevErrors, category_uuid: "" }));
    }
  };

  useEffect(() => {
    setAsset((prev) => ({
      ...prev,
      status: markAsSold ? "sold" : "holding",
      sale_date: markAsSold
        ? prev.sale_date || getCurrentDateFormatted()
        : null,
      sale_price: markAsSold
        ? prev.sale_price ?? prev.price ?? ""
        : null,
      fees: markAsSold ? prev.fees ?? 0 : 0,
      buyer: markAsSold ? prev.buyer || "" : "",
      notes: markAsSold ? prev.notes || "" : "",
      realized_profit: markAsSold ? prev.realized_profit ?? null : null,
    }));
  }, [markAsSold]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!asset.name?.trim()) {
      newErrors.name = "资产名称不能为空。";
    }

    if (!asset.purchase_date) {
      newErrors.purchaseDate = "购买日期不能为空。";
    } else {
      const parsedPurchaseDate = parseISO(asset.purchase_date);
      const currentDate = new Date();

      // 检查购买日期是否是未来日期
      if (isAfter(parsedPurchaseDate, currentDate)) {
        newErrors.purchaseDate = "购买日期不能是未来日期。";
      }
    }

    // 验证时，将 price 视作数字
    const priceValue = parseFloat(String(asset.price));
    if (asset.price === undefined || isNaN(priceValue) || priceValue < 0) {
      newErrors.price = "价格必须是有效数字且大于等于0。";
    }

    const salePriceValue =
      asset.sale_price === null || asset.sale_price === undefined
        ? undefined
        : parseFloat(String(asset.sale_price));
    const feesValue =
      asset.fees === null || asset.fees === undefined
        ? 0
        : parseFloat(String(asset.fees));

    if (!asset.category_uuid) {
      newErrors.category_uuid = "请选择资产分类。";
    }

    if (
      asset.expiration_date &&
      asset.purchase_date &&
      isBefore(parseISO(asset.expiration_date), parseISO(asset.purchase_date))
    ) {
      newErrors.expirationDate = "过期日期不能早于购买日期。";
    }

    if (markAsSold) {
      if (
        salePriceValue === undefined ||
        isNaN(salePriceValue) ||
        salePriceValue < 0
      ) {
        newErrors.sale_price = "卖出价格必须是有效数字且大于等于0。";
      }
      if (!asset.sale_date) {
        newErrors.sale_date = "卖出日期不能为空。";
      } else if (
        asset.purchase_date &&
        isBefore(parseISO(asset.sale_date), parseISO(asset.purchase_date))
      ) {
        newErrors.sale_date = "卖出日期不能早于购买日期。";
      }
      if (isNaN(feesValue) || feesValue < 0) {
        newErrors.fees = "费用不能为负数。";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // 在提交前，将 price 字段转换为数字
      const priceValue = parseFloat(String(asset.price)) || 0;
      const salePriceValue =
        asset.sale_price === undefined || asset.sale_price === null
          ? null
          : parseFloat(String(asset.sale_price));
      const feesValue =
        asset.fees === undefined || asset.fees === null
          ? 0
          : parseFloat(String(asset.fees));

      const isSold = markAsSold;
      const dataToSubmit: Partial<Asset> = {
        ...asset,
        status: isSold ? "sold" : "holding",
        price: priceValue,
        sale_price: isSold ? salePriceValue : null,
        sale_date: isSold ? asset.sale_date || null : null,
        fees: isSold ? feesValue : 0,
        buyer: isSold ? asset.buyer || "" : "",
        notes: isSold ? asset.notes || "" : "",
        realized_profit:
          isSold && salePriceValue !== null && salePriceValue !== undefined
            ? salePriceValue - priceValue - (feesValue || 0)
            : null,
      };
      onSubmit(dataToSubmit);
    }
  };

  // 将资产分类转换为 CustomSelect 需要的 options 格式
  // 在生成下拉选项时，对默认分类进行翻译
  const categoryOptions = categories.map((category) => ({
    value: category.uuid,
    label:
      category.is_default === 1
        ? t("management.asset.category.defaultCategory")
        : category.name,
  }));

  return (
    <Form onSubmit={handleSubmit} className="asset-form">
      <FormGroup>
        <Label htmlFor="name">{t("management.asset.name")}</Label>
        <Input
          type="text"
          id="name"
          name="name"
          value={asset.name || ""}
          onChange={handleChange}
          placeholder={t("management.asset.placeholder")}
          required
        />
        {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="category">
          {t("management.asset.category.category")}
        </Label>
        <CustomSelect
          options={categoryOptions}
          value={asset.category_uuid}
          onChange={handleCategoryChange}
          placeholder={
            isLoadingCategories
              ? t("common.loading")
              : t("management.asset.category.selectPlaceholder")
          }
        />
        {errors.category_uuid && (
          <ErrorMessage>{errors.category_uuid}</ErrorMessage>
        )}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="price">{t("common.price")}</Label>
        <Input
          type="number"
          step="any"
          id="price"
          name="price"
          value={asset.price ?? ""}
          onChange={handleChange}
          min="0"
          required
        />
        {errors.price && <ErrorMessage>{errors.price}</ErrorMessage>}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="purchase_date">{t("common.purchaseDate")}</Label>
        <Input
          type="date"
          id="purchase_date"
          name="purchase_date"
          value={asset.purchase_date || ""}
          onChange={handleChange}
          required
      />
      {errors.purchaseDate && (
        <ErrorMessage>{errors.purchaseDate}</ErrorMessage>
      )}
    </FormGroup>

    <FormGroup>
      <Label htmlFor="brand">{t("management.asset.brandOptional")}</Label>
      <Input
        type="text"
        id="brand"
          name="brand"
          value={asset.brand || ""}
          onChange={handleChange}
        />
        {errors.brand && <ErrorMessage>{errors.brand}</ErrorMessage>}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="expiration_date">
          {t("common.expirationDateOptional")}
        </Label>
        <Input
          type="date"
          id="expiration_date"
          name="expiration_date"
          value={asset.expiration_date || ""}
          onChange={handleChange}
        />
        {errors.expirationDate && (
          <ErrorMessage>{errors.expirationDate}</ErrorMessage>
        )}
      </FormGroup>

      <FormGroup>
        <Label htmlFor="mark_sold">{t("management.asset.sellStatusLabel")}</Label>
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <input
          id="mark_sold"
          type="checkbox"
          checked={markAsSold}
          onChange={(e) => setMarkAsSold(e.target.checked)}
        />
        <span>
          {markAsSold
            ? t("management.asset.markedSold")
            : t("management.asset.markSold")}
        </span>
      </div>
    </FormGroup>

    {markAsSold && (
      <>
        <FormGroup>
          <Label htmlFor="sale_price">
            {t("management.asset.salePrice")}
          </Label>
          <Input
            type="number"
            step="any"
            id="sale_price"
            name="sale_price"
            value={asset.sale_price ?? ""}
            onChange={handleChange}
            min="0"
            required={markAsSold}
          />
          {errors.sale_price && (
            <ErrorMessage>{errors.sale_price}</ErrorMessage>
          )}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="sale_date">{t("management.asset.saleDate")}</Label>
          <Input
            type="date"
            id="sale_date"
            name="sale_date"
            value={asset.sale_date || ""}
            onChange={handleChange}
            required={markAsSold}
          />
          {errors.sale_date && (
            <ErrorMessage>{errors.sale_date}</ErrorMessage>
          )}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="fees">{t("management.asset.saleFees")}</Label>
          <Input
            type="number"
            step="any"
            id="fees"
            name="fees"
            value={asset.fees ?? 0}
            onChange={handleChange}
            min="0"
          />
          {errors.fees && <ErrorMessage>{errors.fees}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="buyer">
            {t("management.asset.buyerNotesOptional")}
          </Label>
          <Textarea
            id="buyer"
            name="buyer"
            value={asset.buyer || ""}
            onChange={handleChange}
            rows={3}
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="notes">
            {t("management.asset.saleNotesOptional")}
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={asset.notes || ""}
            onChange={handleChange}
            rows={3}
          />
        </FormGroup>
      </>
    )}

      <FormGroup id="description-form-group">
        <Label htmlFor="description">{t("common.descriptionOptional")}</Label>
        <Textarea
          id="description"
          name="description"
          value={asset.description || ""}
          onChange={handleChange}
          rows={3}
          placeholder={t("management.asset.placeholderDescription")}
        />
      </FormGroup>

  <div className="submit-button-container">
    <SubmitButton
      type="submit"
          disabled={
            Object.keys(errors).length > 0 &&
            Object.values(errors).some((err) => err !== "")
          }
        >
          {initialData
            ? t("management.asset.update")
            : t("management.asset.addAsset")}
        </SubmitButton>
      </div>
    </Form>
  );
};

export default AssetForm;
