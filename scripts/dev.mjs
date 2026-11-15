import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import concurrently from 'concurrently';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));
const services = [
  { name: 'api', port: 4000, command: 'pnpm --filter @tandem/server dev' },
  { name: 'web', port: 3000, command: 'pnpm --filter @tandem/client dev' },
];

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false);
      } else {
        reject(error);
      }
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
  });
}

const availableServices = [];
for (const service of services) {
  if (await isPortInUse(service.port)) {
    console.log(`Skipping ${service.name}: port ${service.port} is already in use.`);
  } else {
    availableServices.push({
      name: service.name,
      command: service.command,
      cwd: rootDirectory,
    });
  }
}

if (availableServices.length === 0) {
  console.log('Both service ports are occupied; no duplicate processes were started.');
} else {
  const { result } = concurrently(availableServices, {
    cwd: rootDirectory,
    killOthers: ['success', 'failure'],
  });
  result.then(
    (events) => {
      process.exitCode = events.some(({ exitCode, killed }) => !killed && exitCode !== 0) ? 1 : 0;
    },
    (error) => {
      console.error('Development services failed:', error);
      process.exitCode = 1;
    },
  );
}
