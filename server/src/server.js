import http from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocket } from './sockets/index.js';

const app = createApp();
const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`🧺 LMS server กำลังทำงานที่ http://localhost:${env.PORT} (env: ${env.NODE_ENV})`);
});
