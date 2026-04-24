const net = require('node:net');

const databaseUrl =
  process.env.DB_WAIT_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
const databaseUrlSource = process.env.DB_WAIT_URL
  ? 'DB_WAIT_URL'
  : process.env.DIRECT_URL
    ? 'DIRECT_URL'
    : process.env.DATABASE_URL
      ? 'DATABASE_URL'
      : null;

if (!databaseUrl) {
  console.error('DB_WAIT_URL, DIRECT_URL, or DATABASE_URL is not set');
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);
const host = parsedUrl.hostname;
const port = Number(parsedUrl.port || 5432);
const maxAttempts = Number(process.env.DB_WAIT_MAX_ATTEMPTS || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tryConnect = () =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    socket.setTimeout(5000);

    socket.once('connect', () => {
      socket.end();
      resolve();
    });

    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`Timed out connecting to ${host}:${port}`));
    });

    socket.once('error', (error) => {
      socket.destroy();
      reject(error);
    });
  });

const waitForDatabase = async () => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await tryConnect();
      console.log(
        `Database is reachable at ${host}:${port} using ${databaseUrlSource}`
      );
      return;
    } catch (error) {
      console.log(
        `Waiting for database (${attempt}/${maxAttempts}): ${error.message}`
      );

      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(delayMs);
    }
  }
};

waitForDatabase().catch((error) => {
  console.error(`Database wait failed: ${error.message}`);
  process.exit(1);
});
