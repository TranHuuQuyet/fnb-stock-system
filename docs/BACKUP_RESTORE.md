# Backup Va Restore

Tai lieu nay mo ta cach sao luu va khoi phuc du lieu production cho he thong `fnbstore.store`.

## 1. Backup la gi

- `Backup` la ban sao du lieu duoc tao dinh ky de dung khi co su co.
- Voi du an nay, phan can backup quan trong nhat la `PostgreSQL`.

## 2. Restore la gi

- `Restore` la thao tac khoi phuc du lieu tu mot ban backup cu.
- Dung khi:
  - xoa nham du lieu
  - deploy sai lam hong du lieu
  - database loi hoac hong may chu
  - can dung lai he thong sau su co

## 3. Chinh sach khuyen nghi

- Backup full moi ngay vao cuoi ngay
- Neu dich vu database ho tro `point-in-time recovery`, nen bat them
- Giu it nhat:
  - `14` ban daily
  - `8` ban weekly
  - `3` ban monthly

## 4. Ai chiu trach nhiem

- Nguoi chiu trach nhiem restore nen la `nguoi phu trach ky thuat` hoac `don vi trien khai`
- Khong nen giao thao tac restore cho quan ly chi nhanh hoac nhan vien cua hang

## 5. Checklist backup

1. Backup job phai chay tu dong
2. Backup file phai luu o noi khac voi may chay app neu co the
3. Backup phai co ma hoa neu dua ra ngoai may chu
4. Phai co canh bao khi backup that bai
5. Phai test restore dinh ky
6. Phai co `backup manifest` hoac `backup id` de truy vet duoc ban sao cuoi cung
7. Phai xac nhan retention policy dang duoc ap dung

## 6. Goi y automation backup

Neu may van hanh dung PowerShell, co the dat lich job hang ngay bang script:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/backup-postgres.ps1 `
  -DatabaseUrl "postgresql://fnb_user:strong-password@db-host:5432/fnb_stock" `
  -OutputDir "D:\fnb-backups" `
  -Label "production-daily" `
  -RetentionDays 30 `
  -PruneOldBackups
```

Script se tao file backup va cap nhat `latest-backup.json` trong thu muc backup. File manifest nay nen duoc luu vao bien ban release hoac nhat ky van hanh.

## 7. Checklist backup automation chat hon

1. Co lich chay tu dong ro rang: gio chay, may chay, nguoi chiu trach nhiem
2. Co co che prune backup cu hon theo retention
3. Co `latest-backup.json` hoac metadata tuong duong
4. Co canh bao khi:
   - job backup khong chay
   - khong tao duoc file moi
   - checksum khong sinh ra
   - dung luong dia vuot nguong
5. Co restore drill it nhat moi thang tren DB test rieng
6. Co ghi bien ban restore drill: backup nao, ai chay, mat bao lau, co smoke test sau restore hay khong

## 8. Vi du backup PostgreSQL

```bash
pg_dump -Fc -d "postgresql://fnb_user:strong-password@db-host:5432/fnb_stock" > /backups/fnb_stock_$(date +%F).dump
```

## 9. Vi du restore thu nghiem

```bash
createdb fnb_stock_restore
pg_restore -d fnb_stock_restore /backups/fnb_stock_2026-04-14.dump
```

## 10. Quy trinh restore de xuat

1. Xac dinh thoi diem du lieu bat dau sai
2. Chon ban backup gan nhat con dung
3. Restore vao database test truoc
4. Kiem tra login, user, batch, scan logs, work schedules
5. Neu du lieu dung moi quyet dinh restore production
6. Sau restore phai chay smoke test toi thieu
7. Ghi lai `backup manifest`, `restore operator`, `thoi gian restore`, `ket qua smoke test`

## 11. Smoke test sau restore

1. Dang nhap bang admin
2. Kiem tra `health` va `health/ready`
3. Mo danh sach user va store
4. Kiem tra danh sach batch
5. Kiem tra scan logs
6. Kiem tra work schedules
7. Kiem tra dashboard co ban
