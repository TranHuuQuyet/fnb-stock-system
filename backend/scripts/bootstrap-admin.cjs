const bcrypt = require('bcrypt');
const { PrismaClient, UserRole, UserStatus } = require('@prisma/client');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const readEnv = (name, fallback) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  return rawValue.trim();
};

const readRequiredEnv = (name) => {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const readBooleanEnv = (name, fallback) => {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
};

async function main() {
  const username = readEnv('BOOTSTRAP_ADMIN_USERNAME', 'admin');
  const fullName = readEnv('BOOTSTRAP_ADMIN_FULL_NAME', 'System Administrator');
  const password = readRequiredEnv('BOOTSTRAP_ADMIN_PASSWORD');
  const forcePasswordChange = readBooleanEnv('BOOTSTRAP_ADMIN_FORCE_RESET', true);
  const storeCode = readEnv('BOOTSTRAP_STORE_CODE');
  const storeName = readEnv('BOOTSTRAP_STORE_NAME');
  const storeTimezone = readEnv('BOOTSTRAP_STORE_TIMEZONE', 'Asia/Ho_Chi_Minh');

  if ((storeCode && !storeName) || (!storeCode && storeName)) {
    throw new Error(
      'BOOTSTRAP_STORE_CODE and BOOTSTRAP_STORE_NAME must be provided together'
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    throw new Error(`User "${username}" already exists`);
  }

  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default'
    }
  });

  let storeId = null;
  if (storeCode && storeName) {
    const store = await prisma.store.upsert({
      where: { code: storeCode },
      update: {
        name: storeName,
        timezone: storeTimezone,
        isActive: true
      },
      create: {
        code: storeCode,
        name: storeName,
        timezone: storeTimezone,
        isActive: true
      }
    });
    storeId = store.id;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      role: UserRole.ADMIN,
      storeId,
      passwordHash,
      status: forcePasswordChange ? UserStatus.MUST_CHANGE_PASSWORD : UserStatus.ACTIVE,
      permissions: []
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: 'BOOTSTRAP_ADMIN',
      entityType: 'User',
      entityId: user.id,
      newData: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
        status: user.status
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        admin: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          status: user.status
        },
        store: storeId
          ? {
              code: storeCode,
              name: storeName,
              timezone: storeTimezone
            }
          : null,
        notes: [
          'Bootstrap admin created successfully',
          forcePasswordChange
            ? 'The account must change password on first login'
            : 'Password change on first login is disabled'
        ]
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(`Bootstrap admin failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
