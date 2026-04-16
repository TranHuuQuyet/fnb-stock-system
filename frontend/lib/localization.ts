const syncStateLabels: Record<string, string> = {
  OFFLINE: 'Ngoại tuyến',
  SYNCING: 'Đang đồng bộ',
  SYNCED: 'Đã đồng bộ',
  SYNC_ERROR: 'Lỗi đồng bộ'
};

const resultStatusLabels: Record<string, string> = {
  SUCCESS: 'Thành công',
  WARNING: 'Cảnh báo',
  ERROR: 'Lỗi'
};

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên'
};

const userStatusLabels: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LOCKED: 'Đã khóa',
  MUST_CHANGE_PASSWORD: 'Cần đổi mật khẩu'
};

const batchStatusLabels: Record<string, string> = {
  ACTIVE: 'Đang sử dụng',
  SOFT_LOCKED: 'Khóa mềm',
  EXPIRED: 'Hết hạn',
  DEPLETED: 'Hết số lượng'
};

const adjustmentTypeLabels: Record<string, string> = {
  INCREASE: 'Tăng',
  DECREASE: 'Giảm'
};

const operationTypeLabels: Record<string, string> = {
  STORE_USAGE: 'Sử dụng tại quán',
  TRANSFER: 'Chuyển kho'
};

const transferStatusLabels: Record<string, string> = {
  IN_TRANSIT: 'Đang vận chuyển',
  RECEIVED: 'Đã nhận'
};

const resultCodeLabels: Record<string, string> = {
  OFFLINE_QUEUED: 'Đã lưu ngoại tuyến',
  SCAN_OK: 'Quét thành công',
  TRANSFER_OK: 'Chuyển kho thành công',
  TRANSFER_PENDING_RECEIPT: 'Đã tạo phiếu chuyển kho',
  TRANSFER_RECEIVED: 'Đã xác nhận chuyển kho',
  WARNING_FIFO: 'Cảnh báo FIFO',
  ERROR_NETWORK_RESTRICTED: 'Mạng chưa được cho phép',
  ERROR_BATCH_NOT_FOUND: 'Không tìm thấy lô',
  ERROR_BATCH_EXPIRED: 'Lô đã hết hạn',
  ERROR_BATCH_DEPLETED: 'Lô đã hết số lượng',
  ERROR_SOFT_LOCKED: 'Lô đang bị khóa mềm',
  ERROR_INSUFFICIENT_QTY: 'Số lượng trong lô không đủ',
  ERROR_FIFO: 'Cần xuất theo FIFO',
  ERROR_TRANSFER_ADMIN_ONLY: 'Chỉ admin được chuyển kho',
  ERROR_TRANSFER_PERMISSION_REQUIRED: 'Tài khoản chưa được cấp quyền chuyển kho',
  ERROR_TRANSFER_DESTINATION_REQUIRED: 'Chưa chọn chi nhánh nhận',
  ERROR_TRANSFER_SAME_STORE: 'Chi nhánh nhận phải khác chi nhánh chuyển',
  ERROR_TRANSFER_STORE_NOT_FOUND: 'Không tìm thấy chi nhánh nhận',
  ERROR_TRANSFER_BATCH_CONFLICT: 'Lô nhận bị trùng mã khác nguyên liệu',
  ERROR_TRANSFER_NOT_FOUND: 'Không tìm thấy phiếu chuyển kho',
  ERROR_TRANSFER_ALREADY_RECEIVED: 'Phiếu chuyển kho đã được xác nhận trước đó',
  ERROR_TRANSFER_CONFIRMATION_NOTE_REQUIRED: 'Cần nhập ghi chú khi số lượng nhận không khớp',
  ERROR_TRANSFER_RECEIVED_QTY_INVALID: 'Số lượng nhận không hợp lệ',
  AUTH_FORBIDDEN: 'Không có quyền thao tác'
};

const apiErrorLabels: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu',
  AUTH_UNAUTHORIZED: 'Bạn chưa đăng nhập hoặc phiên đã hết hạn',
  AUTH_FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  AUTH_ACCOUNT_LOCKED: 'Tài khoản đã bị khóa',
  AUTH_ACCOUNT_INACTIVE: 'Tài khoản đang bị vô hiệu hóa',
  AUTH_MUST_CHANGE_PASSWORD: 'Bạn cần đổi mật khẩu trước khi tiếp tục',
  AUTH_RATE_LIMITED: 'Bạn đăng nhập quá nhanh, vui lòng thử lại sau ít phút',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ',
  VALIDATION_INVALID_PAYLOAD: 'Dữ liệu gửi lên chưa hợp lệ',
  VALIDATION_INVALID_QUERY: 'Điều kiện tìm kiếm chưa hợp lệ',
  ADMIN_ERROR_INGREDIENT_UNIT_NOT_FOUND: 'Không tìm thấy đơn vị',
  ADMIN_ERROR_INGREDIENT_NOT_FOUND: 'Không tìm thấy nguyên liệu',
  ADMIN_ERROR_STORE_NOT_FOUND: 'Không tìm thấy chi nhánh',
  ERROR_NETWORK_RESTRICTED: 'Thiết bị đang dùng mạng chưa được cho phép',
  ERROR_BATCH_NOT_FOUND: 'Không tìm thấy lô nguyên liệu',
  ERROR_BATCH_EXPIRED: 'Lô nguyên liệu đã hết hạn',
  ERROR_BATCH_DEPLETED: 'Lô nguyên liệu đã hết số lượng',
  ERROR_SOFT_LOCKED: 'Lô nguyên liệu đang bị khóa mềm',
  ERROR_INSUFFICIENT_QTY: 'Số lượng còn lại của lô không đủ',
  ERROR_FIFO: 'Cần sử dụng lô cũ hơn trước theo FIFO',
  ERROR_TRANSFER_ADMIN_ONLY: 'Chỉ quản trị viên mới được chuyển kho',
  ERROR_TRANSFER_PERMISSION_REQUIRED: 'Tài khoản chưa được cấp quyền chuyển kho',
  ERROR_TRANSFER_DESTINATION_REQUIRED: 'Vui lòng chọn chi nhánh nhận',
  ERROR_TRANSFER_SAME_STORE: 'Chi nhánh nhận phải khác chi nhánh chuyển',
  ERROR_TRANSFER_STORE_NOT_FOUND: 'Không tìm thấy chi nhánh nhận hợp lệ',
  ERROR_TRANSFER_BATCH_CONFLICT: 'Chi nhánh nhận có lô trùng mã nhưng khác nguyên liệu',
  ERROR_TRANSFER_NOT_FOUND: 'Không tìm thấy phiếu chuyển kho',
  ERROR_TRANSFER_ALREADY_RECEIVED: 'Phiếu chuyển kho đã được xác nhận trước đó',
  ERROR_TRANSFER_CONFIRMATION_NOTE_REQUIRED: 'Vui lòng nhập ghi chú khi số lượng nhận không khớp',
  ERROR_TRANSFER_RECEIVED_QTY_INVALID: 'Số lượng nhận không được vượt quá số lượng đã gửi',
  ERROR_DUPLICATE_CLIENT_EVENT: 'Yêu cầu quét đã được ghi nhận trước đó',
  ERROR_INVALID_QR_FORMAT: 'Mã QR không đúng định dạng',
  POS_IMPORT_ERROR: 'Không thể nhập dữ liệu bán hàng POS',
  POS_RECONCILIATION_ERROR: 'Không thể đối soát dữ liệu POS',
  STOCK_ADJUSTMENT_INVALID: 'Phiếu điều chỉnh tồn không hợp lệ',
  STOCK_ADJUSTMENT_EXCEEDS_REMAINING: 'Số lượng điều chỉnh vượt quá tồn còn lại',
  QR_GENERATION_ERROR: 'Không thể tạo mã QR',
  QR_LABEL_RENDER_ERROR: 'Không thể tạo nhãn in',
  SYSTEM_DATABASE_ERROR: 'Có lỗi cơ sở dữ liệu, vui lòng thử lại',
  ERROR_INTERNAL_SERVER: 'Đã có lỗi hệ thống, vui lòng thử lại'
};

const fallback = (value: string) => value.replace(/_/g, ' ');

export const localizeSyncState = (value: string) => syncStateLabels[value] ?? fallback(value);

export const localizeResultStatus = (value: string) =>
  resultStatusLabels[value] ?? fallback(value);

export const localizeRole = (value: string) => roleLabels[value] ?? fallback(value);

export const localizeUserStatus = (value: string) =>
  userStatusLabels[value] ?? fallback(value);

export const localizeBatchStatus = (value: string) =>
  batchStatusLabels[value] ?? fallback(value);

export const localizeAdjustmentType = (value: string) =>
  adjustmentTypeLabels[value] ?? fallback(value);

export const localizeOperationType = (value: string) =>
  operationTypeLabels[value] ?? fallback(value);

export const localizeTransferStatus = (value: string) =>
  transferStatusLabels[value] ?? fallback(value);

export const localizeResultCode = (value: string) =>
  resultCodeLabels[value] ?? fallback(value);

export const localizeApiError = (code: string, fallbackMessage: string) => {
  if (/[À-ỹà-ỹ]/.test(fallbackMessage)) {
    return fallbackMessage;
  }

  return apiErrorLabels[code] ?? fallbackMessage;
};
