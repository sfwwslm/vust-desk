import styled from "styled-components";
import { Theme } from "@/styles/themes";
export {
  FormGroup,
  Label,
  Input,
  Textarea,
} from "@/components/styled/StyledForm";
export { StyledButton as SubmitButton } from "@/components/styled/StyledButton";

/**
 * @const Form
 * @description 表单容器样式
 */
export const Form = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: calc(${(props) => props.theme.spacing.unit} * 2);
  align-items: baseline;

  #description-form-group {
    grid-column: 1 / -1;
  }

  /* 恢复原有的按钮容器样式 */
  .submit-button-container {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    margin-top: calc(${(props) => props.theme.spacing.unit} * 2);
  }
`;

/**
 * @const ErrorMessage
 * @description 错误信息样式
 */
export const ErrorMessage = styled.p<{ theme: Theme }>`
  color: ${(props) => props.theme.colors.error};
  font-size: 0.8rem;
  margin-top: calc(${(props) => props.theme.spacing.unit} / 2);
`;
