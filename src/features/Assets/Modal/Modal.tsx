import React from "react";
import { Overlay } from "@/components/styled/StyledModal";
import { ModalProps } from "@/features/Assets/types";
import { IoCloseSharp } from "react-icons/io5";
import {
  AssetModalBody,
  AssetModalCloseButton,
  AssetModalContainer,
  AssetModalHeader,
  AssetModalTitle,
} from "./Modal.styles";

/**
 * @component Modal
 * @param {ModalProps} props - 模态框组件的props
 * @description 通用模态框组件，带有进入/退出动画和关闭按钮。
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  // 如果模态框不打开，则不渲染任何内容
  if (!isOpen) return null;

  return (
    // Overlay 动画：初始隐藏，进入时渐入，退出时渐出
    <Overlay
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ModalContainer 动画：初始Y轴偏移，进入时弹出，退出时缩放消失 */}
      <AssetModalContainer
        className="modal-container"
        initial={{ y: -50, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -50, opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()} // 阻止事件冒泡，避免点击模态框内容关闭模态框
      >
        <AssetModalHeader className="asset-modal__header">
          {title && (
            <AssetModalTitle className="asset-modal__title">
              {title}
            </AssetModalTitle>
          )}
          <AssetModalCloseButton
            className="asset-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IoCloseSharp />
          </AssetModalCloseButton>
        </AssetModalHeader>
        <AssetModalBody className="asset-modal__body">
          {children}
        </AssetModalBody>
      </AssetModalContainer>
    </Overlay>
  );
};

export default Modal;
