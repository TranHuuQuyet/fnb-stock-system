import { z, ZodIssueCode } from 'zod';

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: 'Vui lòng nhập trường này' };
      }
      if (issue.expected === 'number') {
        return { message: 'Vui lòng nhập số hợp lệ' };
      }
      if (issue.expected === 'boolean') {
        return { message: 'Giá trị lựa chọn không hợp lệ' };
      }
      return { message: 'Dữ liệu nhập vào không đúng định dạng' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return {
          message:
            issue.minimum === 1
              ? 'Vui lòng nhập trường này'
              : `Vui lòng nhập ít nhất ${issue.minimum} ký tự`
        };
      }
      if (issue.type === 'number') {
        return { message: `Giá trị phải lớn hơn hoặc bằng ${issue.minimum}` };
      }
      if (issue.type === 'array') {
        return { message: `Vui lòng chọn ít nhất ${issue.minimum} mục` };
      }
      return { message: ctx.defaultError };
    case ZodIssueCode.too_big:
      if (issue.type === 'number') {
        return { message: `Giá trị phải nhỏ hơn hoặc bằng ${issue.maximum}` };
      }
      return { message: ctx.defaultError };
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Giá trị được chọn không hợp lệ' };
    default:
      return { message: ctx.defaultError };
  }
});

export {};
