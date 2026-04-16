# Release Template

Dung mau nay de ghi lai moi dot release truoc khi pilot hoac go-live.

```text
Release tag:
Commit SHA:
Ngay deploy:
Nguoi deploy:
Moi truong: staging / production

Pham vi thay doi:
- 

Migration moi:
- co / khong
- ten migration:

Env can kiem tra:
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CORS_ORIGIN
- NEXT_PUBLIC_API_BASE_URL

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

Risk con lai:
- 

Rollback plan:
- app rollback tag:
- co can rollback database khong:

Ket luan:
- release / hold
```
