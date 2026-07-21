import { startServer, DEFAULT_API_PORT } from "./app.js";

const port = Number(process.env.PORT ?? DEFAULT_API_PORT);
startServer(port)
  .then(() => {
    console.log(`Just Me API listening on http://127.0.0.1:${port}`);
  })
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the other process or choose another PORT.`);
      process.exit(1);
    }
    throw error;
  });
