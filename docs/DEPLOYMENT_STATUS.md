# Deployment Status

Tai lieu nay dung de ghi lai trang thai rollout thuc te tren VPS va production. Hay cap nhat file nay sau moi moc quan trong de README va cac checklist chung khong bi bien thanh log van hanh.

## Cap nhat gan nhat

- Ngay cap nhat: `2026-04-22`
- Moi truong dang theo doi: `production rollout tren VPS`
- SSH vao VPS: `da xac nhan`
- Admin production dau tien: `da tao`
- Doi mat khau sau first login: `da hoan thanh`
- Frontend public qua `https://fnbstore.store`: `da xac nhan`
- Backend health `https://fnbstore.store/api/v1/health`: `da xac nhan`
- Prisma migrate production: `da chay thanh cong`

## Da hoan thanh

- [x] Truy cap SSH vao VPS `103.165.144.144`
- [x] Xac nhan repo da co luong production rieng bang `docker-compose.prod.yml`
- [x] Tao admin production dau tien bang `bootstrap:admin`
- [x] Dang nhap admin bootstrap va doi mat khau ngay sau lan dang nhap dau tien
- [x] Khong con phu thuoc vao tai khoan demo seeded de vao production
- [x] Dong bo `README.md` va cac runbook/checklist de phan anh dung trang thai rollout hien tai
- [x] Sua `DATABASE_URL` production de ket noi dung PostgreSQL Neon va chay `migrate` thanh cong
- [x] Xac nhan domain public, DNS va TLS dang tra ve app production
- [x] Xac nhan frontend public va backend `health` dang tra `ok`
- [x] Them `ops.sh`, `deploy/scripts/prod-ops.sh` va `docs/VPS_OPERATIONS.md` de van hanh production hang ngay

## Viec con lai can chot

- [ ] Xac nhan `.env.production.compose`, `backend/.env.production`, `frontend/.env.production` va `deploy/.env.ops`
- [ ] Xac nhan PostgreSQL production va backup off-host dang hoat dong
- [ ] Chay `preflight-check.ps1` hoac checklist tuong duong tren may deploy thuc te
- [ ] Chay smoke test production sau deploy
- [ ] Tao them store, manager, staff va danh muc van hanh ban dau
- [ ] Chot tai khoan admin rieng cho smoke test, khong dung tai khoan ca nhan

## Luu y van hanh

- Khong chay lai `bootstrap:admin` voi cung `username` da ton tai.
- Khong dung `docker-compose.yml` local/demo de mo production public.
- Giu credential bootstrap, lich su ban giao va nguoi so huu tai khoan trong runbook noi bo, khong commit vao repo.
- Neu admin dau tien da doi mat khau xong, danh dau hoan tat buoc nay trong checklist go-live va smoke evidence.
- `migrate` co the hien `Exited (0)` sau khi chay xong; day la binh thuong voi stack production hien tai.
