import { startServer } from "./app.js";

const port = Number(process.env.PORT ?? 7841);
startServer(port).then(() => {
  console.log(`Just Me API listening on http://127.0.0.1:${port}`);
});
