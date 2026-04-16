# Pilot Runbook

Tai lieu nay dung cho giai doan pilot 2 chi nhanh dau tien truoc khi mo rong su dung thuc te. Muc tieu la giu pilot nho, co kiem soat, va ghi lai du van de de sua truoc khi go-live rong hon.

Nen dung kem:

- [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)
- [UAT_CHECKLIST.md](./UAT_CHECKLIST.md)
- [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
- [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)
- [OPERATION_MANUAL.md](./OPERATION_MANUAL.md)
- [PILOT_DAILY_LOG_TEMPLATE.md](./PILOT_DAILY_LOG_TEMPLATE.md)

## 1. Muc tieu pilot

- Xac nhan quy trinh kho va nhan su chay duoc o moi truong that
- Xac nhan manager va staff su dung duoc tren thiet bi that
- Phat hien loi van hanh truoc khi mo rong them chi nhanh

## 2. Pham vi pilot de xuat

- `2 chi nhanh`
- moi chi nhanh:
  - `1 MANAGER`
  - `2-3 STAFF`
- thoi gian pilot:
  - `3-7 ngay`

Khuyen nghi:

- chi dung cac luong da chot:
  - scan `Su dung tai quan`
  - chuyen kho `IN_TRANSIT -> RECEIVED`
  - ca lam va bang luong
  - bao cao admin
- chua dua POS vao pilot neu hien tai chua la uu tien

## 3. Truoc ngay pilot

1. Chot release tag se dem di pilot
2. Hoan thanh staging va UAT
3. In thu tem tren may in that
4. Chot danh sach user pilot
5. Chot IP whitelist cua 2 chi nhanh
6. Chot nguoi dau moi:
   - 1 nguoi ky thuat
   - 1 admin he thong
   - 1 manager moi chi nhanh

## 4. Checklist ngay bat dau pilot

1. Deploy dung tag release
2. Neu chua co env staging that, khoi tao nhanh:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/init-staging.ps1`
3. Chay preflight check:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging`
4. Chay smoke test:
   - `powershell -ExecutionPolicy Bypass -File deploy/scripts/smoke-test.ps1 -BaseUrl https://fnbstore.store`
5. Dang nhap admin
6. Kiem tra:
   - store
   - user
   - ingredient unit
   - ingredient group
   - ingredient
   - batch
7. Tao 1 batch test va in tem
8. Quet thu 1 lan tai moi chi nhanh
9. Tao 1 phieu chuyen kho A -> B
10. Xac nhan nhan tai chi nhanh B
11. Kiem tra `Admin > Reports`

## 5. Trong thoi gian pilot can theo doi gi

Moi ngay nen ghi lai:

- so lan login loi
- so scan bi reject
- so scan offline chua sync
- so phieu chuyen kho cho xac nhan qua lau
- sai lech ton kho ro rang
- loi bang luong hoac export Excel
- su co whitelist/bypass

## 6. Lich kiem tra de xuat

### Dau ca

1. Manager dang nhap
2. Kiem tra `network-status`
3. Kiem tra thiet bi scan
4. Kiem tra batch duoc dung trong ca

### Giua ca

1. Theo doi scan loi
2. Neu can chuyen kho, manager tao phieu va manager ben nhan xac nhan
3. Khong cho staff tu lam chuyen kho neu chua duoc cap quyen

### Cuoi ca

1. Kiem tra scan logs
2. Kiem tra offline queue da sync het neu co mang
3. Kiem tra ton kho cac nguyen lieu chinh
4. Kiem tra su co phat sinh trong ca

## 7. Cac tinh huong can dung pilot de sua truoc

Dung pilot de fix truoc khi mo rong neu gap:

1. Login loi hang loat
2. Scan thanh cong nhung ton kho sai ro rang
3. Chuyen kho tao hoac nhan khong on dinh
4. Bang luong tinh sai hang loat
5. Offline queue mat du lieu hoac sync trung

## 8. Bien ban pilot moi ngay

Moi ngay nen co 1 bien ban ngan:

- ngay
- chi nhanh
- release tag dang chay
- su co da gap
- workaround da dung
- muc do anh huong
- de xuat fix

Co the dung mau san tai [PILOT_DAILY_LOG_TEMPLATE.md](./PILOT_DAILY_LOG_TEMPLATE.md).

## 9. Dieu kien pass pilot

Pilot duoc coi la pass khi:

1. 2 chi nhanh chay on dinh trong it nhat 3 ngay lien tiep
2. Khong con blocker o:
   - login
   - scan
   - chuyen kho
   - bang luong
3. Backup va restore da duoc test
4. Doi van hanh da nam duoc quy trinh co ban

## 10. Sau pilot

1. Tong hop loi va backlog
2. Chot release tag on dinh nhat sau pilot
3. Cap nhat [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) neu co thay doi quy trinh
4. Chi mo rong them chi nhanh khi da chot xong cac loi muc do cao
