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

Neu may operator dung PowerShell, co the dat lich job hang ngay bang script:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/run-backup-job.ps1 `
  -Environment production
```

Script wrapper nay se:

1. Doc `DIRECT_URL` tu `backend/.env.production` hoac `backend/.env.staging` neu co; neu khong co thi moi fallback sang `DATABASE_URL`
2. Tao backup daily
3. Tu dong promote sang weekly/monthly theo lich
4. Cap nhat `latest-backup.json`
5. Mirror sang `BACKUP_MIRROR_DIR` neu da cau hinh
6. Gọi alert webhook neu job loi

File `deploy/.env.ops` la noi chot cac gia tri van hanh:

```dotenv
ALERT_WEBHOOK_URL=
ALERT_WEBHOOK_HEADERS_JSON=
ALERT_NOTIFY_ON_SUCCESS=false
BACKUP_ROOT_DIR=backups
BACKUP_MIRROR_DIR=
BACKUP_DAILY_RETENTION=14
BACKUP_WEEKLY_RETENTION=8
BACKUP_MONTHLY_RETENTION=3
BACKUP_WEEKLY_DAY=Sunday
BACKUP_MINIMUM_SIZE_BYTES=10240
PRODUCTION_BACKUP_MANIFEST_PATH=
STAGING_BACKUP_MANIFEST_PATH=
```

De trong `*_BACKUP_MANIFEST_PATH` neu muon script tu suy ra mac dinh `<BACKUP_ROOT_DIR>/<environment>/latest-backup.json`.

File manifest nay nen duoc luu vao bien ban release hoac nhat ky van hanh.

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

## 7.1. Mo hinh van hanh khuyen nghi

Neu muon chay on dinh va de ban giao:

1. Dung `pg_dump` cho backup logic hang ngay
2. Luu file backup va `latest-backup.json` sang storage rieng, khong chi nam tren app disk
3. Giữ retention theo chinh sach `14` daily, `8` weekly, `3` monthly
4. Test restore it nhat 1 lan truoc go-live va sau do lap lai theo lich
5. Ghi ro trong bien ban:
   - backup nao duoc dung
   - ai thuc hien restore
   - restore mat bao lau
   - smoke test sau restore co pass hay khong
6. Neu co PITR cua nha cung cap DB thi bat them, nhung van phai co restore drill thu cong

### 7.2. Goi y dat lich backup

Neu chay tren Windows Server:

1. Tao mot `Task Scheduler` job chay moi ngay
2. Lenh de xuat:

```powershell
powershell -ExecutionPolicy Bypass -File C:\path\to\fnb-stock-system\deploy\scripts\run-backup-job.ps1 -Environment production
```

Neu chay tren Linux:

1. Dung `cron` hoac `systemd timer`
2. Gọi PowerShell 7 neu doi van hanh da chuan hoa theo script `.ps1`
3. Luu output vao file log rieng de doi voi alert webhook

## 8. Vi du backup PostgreSQL

```bash
pg_dump -Fc -d "postgresql://fnb_user:strong-password@db-direct-host:5432/fnb_stock" > /backups/fnb_stock_$(date +%F).dump
```

## 9. Vi du restore thu nghiem

```bash
createdb fnb_stock_restore
pg_restore -d "postgresql://fnb_user:strong-password@db-direct-host:5432/fnb_stock_restore" /backups/fnb_stock_2026-04-14.dump
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
7. Kiem tra admin reports hoac ingredient stock co ban
