# Quick Start Guide

## For Developers

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for containerized setup)
- PostgreSQL 14+ (if running locally without Docker)
- Git

### Option 1: Docker (Recommended for Local Development)

```bash
# Clone the repository
git clone <repo-url>
cd fnb-stock-system

# Start all services
docker compose up --build

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:4000
# Swagger API Docs: http://localhost:4000/api/docs
# Database: PostgreSQL at localhost:5432 (postgres/postgres)

# Demo credentials
# Username: admin
# Password: 123456
```

### Option 2: Local Development (No Docker)

```bash
# Setup backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
npm run start:dev
# Backend runs on http://localhost:4000

# In another terminal, setup frontend
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3001
```

## For Operations / VPS Deployment

### Initial VPS Setup

```bash
# SSH into VPS
ssh root@<VPS_IP>

# Navigate to app directory
cd /opt/fnb-stock-system

# Make scripts executable
chmod +x ops.sh deploy/scripts/prod-ops.sh

# Check status
./ops.sh status
```

### Common Operations

```bash
# Start/stop services
./ops.sh up
./ops.sh down

# View logs
./ops.sh logs

# Restart specific service
./ops.sh restart backend
./ops.sh restart frontend

# Health check
./ops.sh health

# Database status
./ops.sh db-status
```

### Deploy New Version

```bash
# Get latest code
git pull origin main

# Rebuild and restart
./ops.sh rebuild

# Verify deployment
./ops.sh status
```

### Backup & Restore

```bash
# Create backup
./deploy/scripts/backup-postgres.ps1

# Restore from backup
./deploy/scripts/restore-postgres.ps1

# List recent backups
ls -lh /root/fnb-backup/
```

## Admin Tasks

### First Login Setup

1. Login with bootstrap admin credentials
2. Change password immediately
3. Create manager users for each store
4. Create staff users as needed
5. Configure ingredient master data

### Configure Stores

```
Admin > Stores
├── Add store name
├── Set address
├── Configure IP whitelist
└── Test QR scanning
```

### Setup Ingredients

```
Admin > Ingredients
├── Create ingredient units (pcs, kg, liters, etc)
├── Create ingredient groups (vegetables, meat, dairy, etc)
├── Add ingredients with unit and group
└── Enable ingredients for use
```

### Create Batches & Print Labels

```
Admin > Batches
├── Create new batch with code and quantity
├── Generate QR code
├── Configure print layout (columns/rows)
├── Print labels
└── Apply labels to physical packages
```

### Configure Work Schedules

```
Control > Work Schedules
├── Select store and month
├── Define shifts (Ca 1, Ca 2, Ca 3)
├── Add employees with rates
├── Configure allowances
└── Track attendance
```

## Common Issues & Troubleshooting

### "Cannot connect to database"
- Check PostgreSQL is running: `docker compose exec postgres psql -U postgres`
- Verify DATABASE_URL in .env
- Run migrations: `npm run prisma:migrate:dev`

### "Port already in use"
- Change port in docker-compose.yml or .env
- Or kill process: `lsof -i :3001` or `fuser -k 3001/tcp`

### "Build fails - missing dependencies"
- Clear node_modules: `rm -rf node_modules package-lock.json`
- Reinstall: `npm install`
- Generate Prisma: `npm run prisma:generate`

### "Offline sync not working"
- Check IndexedDB in browser DevTools
- Clear browser cache and reload
- Verify network connectivity
- Check browser console for errors

### "QR code scanning not working"
- Ensure camera permissions granted
- Try different lighting conditions
- Test with printed QR codes first
- Check html5-qrcode permissions

## Development Workflow

### Code Changes
1. Make changes in feature branch
2. Run tests: `npm test`
3. Commit with descriptive message
4. Push and create Pull Request
5. After review, merge to main

### Database Changes
1. Modify `backend/prisma/schema.prisma`
2. Create migration: `npm run prisma:migrate:dev`
3. Commit migration files
4. On deployment: `npm run prisma:migrate:deploy`

### Adding New Features
1. Add backend endpoint in appropriate module
2. Add API service in frontend
3. Create UI components
4. Add offline queue support if needed
5. Write tests
6. Update documentation

## Testing

### Run Tests
```bash
# Backend unit tests
cd backend && npm test

# Backend E2E tests
npm run test:e2e

# Frontend tests
cd frontend && npm test

# Watch mode for development
npm test -- --watch
```

## Documentation

### Important Docs
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [API_OVERVIEW.md](./API_OVERVIEW.md) - API endpoints
- [OPERATION_MANUAL.md](./OPERATION_MANUAL.md) - Daily operations
- [VPS_OPERATIONS.md](./VPS_OPERATIONS.md) - Production operations
- [FEATURES.md](./FEATURES.md) - Feature matrix

### Updating Docs
Always update relevant documentation when:
- Adding new features
- Changing API endpoints
- Modifying database schema
- Deploying to production
- Changing operational procedures

## Getting Help

- Check documentation in `/docs` folder
- Review API documentation at `/api/docs` (Swagger)
- Check test files for usage examples
- Review example `.example` files in root

## Next Steps

1. **Setup Development Environment**: Complete one of the setup options above
2. **Explore Admin Interface**: Login and explore all admin features
3. **Test Scanning**: Try QR scanning in safe mode
4. **Read Documentation**: Thoroughly read OPERATION_MANUAL.md
5. **Setup Test Store**: Create a test store for experimentation
6. **Configure Ingredients**: Add ingredients for testing
7. **Create Test Batch**: Create a batch and test label printing

## Production Readiness Checklist

Before going live, ensure:
- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] Database backups tested
- [ ] Admin credentials changed
- [ ] Store IP whitelists configured
- [ ] Employees and manager accounts created
- [ ] Ingredient data loaded
- [ ] QR scanning tested on actual hardware
- [ ] Network connectivity tested
- [ ] Offline mode tested
- [ ] Emergency bypass configured
- [ ] Team trained on operations

For complete production deployment guide, see [DEPLOYMENT_PROD.md](./DEPLOYMENT_PROD.md).
