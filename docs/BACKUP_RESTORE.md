# Backup Và Restore

Tài liệu này mô tả cách sao lưu và khôi phục dữ liệu production cho hệ thống `fnbstore.store`.

## 1. Backup là gì

- `Backup` là bản sao dữ liệu được tạo định kỳ để dùng khi có sự cố.
- Với dự án này, phần cần backup quan trọng nhất là `PostgreSQL`.

## 2. Restore là gì

- `Restore` là thao tác khôi phục dữ liệu từ một bản backup cũ.
- Dùng khi:
  - xóa nhầm dữ liệu
  - deploy sai làm hỏng dữ liệu
  - database lỗi hoặc hỏng máy chủ
  - cần dựng lại hệ thống sau sự cố

## 3. Chính sách khuyến nghị

- Backup full mỗi ngày vào cuối ngày
- Nếu dịch vụ database hỗ trợ `point-in-time recovery`, nên bật thêm
- Giữ ít nhất:
  - `14` bản daily
  - `8` bản weekly
  - `3` bản monthly

## 4. Ai chịu trách nhiệm

- Người chịu trách nhiệm restore nên là `người phụ trách kỹ thuật` hoặc `đơn vị triển khai`
- Không nên giao thao tác restore cho quản lý chi nhánh hoặc nhân viên cửa hàng

## 5. Checklist backup

1. Backup job phải chạy tự động
2. Backup file phải lưu ở nơi khác với máy chạy app nếu có thể
3. Backup phải có mã hóa nếu đưa ra ngoài máy chủ
4. Phải có cảnh báo khi backup thất bại
5. Phải test restore định kỳ

## 6. Ví dụ backup PostgreSQL

```bash
pg_dump -Fc -d "postgresql://fnb_user:strong-password@db-host:5432/fnb_stock" > /backups/fnb_stock_$(date +%F).dump
```

## 7. Ví dụ restore thử nghiệm

```bash
createdb fnb_stock_restore
pg_restore -d fnb_stock_restore /backups/fnb_stock_2026-04-14.dump
```

## 8. Quy trình restore đề xuất

1. Xác định thời điểm dữ liệu bắt đầu sai
2. Chọn bản backup gần nhất còn đúng
3. Restore vào database test trước
4. Kiểm tra login, user, batch, scan logs, work schedules
5. Nếu dữ liệu đúng mới quyết định restore production
6. Sau restore phải chạy smoke test tối thiểu

## 9. Smoke test sau restore

1. Đăng nhập bằng admin
2. Kiểm tra `health` và `health/ready`
3. Mở danh sách user và store
4. Kiểm tra danh sách batch
5. Kiểm tra scan logs
6. Kiểm tra work schedules
7. Kiểm tra dashboard cơ bản
