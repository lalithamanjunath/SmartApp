import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = '';
    const onData = (buffer) => {
      for (const char of buffer.toString()) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
        } else if (char === '\u0003') {
          process.exit(1);
        } else if (char === '\u007f') {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

try {
  await connectDatabase();
  const name = await ask('Administrator name: ');
  const email = (await ask('Administrator email: ')).toLowerCase();
  const password = await askSecret('Administrator password (min 12 characters): ');
  if (password.length < 12) throw new Error('Password must contain at least 12 characters.');
  const exists = await User.exists({ email });
  if (exists) throw new Error('An account with that email already exists.');
  await User.create({ name, email, password, role: 'admin' });
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
