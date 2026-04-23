# Release Template

Dung mau nay de ghi lai moi dot release truoc khi pilot hoac go-live.

```text
Release tag:
Commit SHA:
Ngay deploy:
Nguoi deploy:
Moi truong: staging / production
Backend image tag:
Frontend image tag:
Deployment status file: docs/DEPLOYMENT_STATUS.md
Ngay cap nhat deployment status:

Pham vi thay doi:
- 

Migration moi:
- co / khong
- ten migration:
- ghi chu anh huong du lieu:

Env can kiem tra:
- DATABASE_URL
- DIRECT_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CORS_ORIGIN
- NEXT_PUBLIC_API_BASE_URL

Trang thai rollout hien tai:
- Admin bootstrap: chua tao / da tao / da tao va da doi mat khau
- Smoke account san sang: co / khong
- Backup manifest san sang: co / khong
- Viec con lai can chot
- 

Smoke test:
- Frontend: pass / fail
- /api/v1/health: pass / fail
- /api/v1/health/ready: pass / fail
- Login admin: pass / fail
- Scan co ban: pass / fail
- Transfer co ban: pass / fail

Backup truoc deploy:
- timestamp:
- nguoi thuc hien:
- backup manifest / backup id:

Smoke evidence:
- workflow smoke test URL:
- artifact release metadata:
- artifact release evidence:

Risk con lai:
- 

Rollback plan:
- app rollback tag:
- backend image rollback:
- frontend image rollback:
- co can rollback database khong:

Ket luan:
- release / hold
```
