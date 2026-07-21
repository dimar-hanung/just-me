import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = dirname(fileURLToPath(import.meta.url));
const packagedWebDist = join(desktopDir, "../web-dist");
const devWebDist = join(desktopDir, "../../web/dist");

process.env.JUST_ME_WEB_DIST = existsSync(join(packagedWebDist, "index.html"))
  ? packagedWebDist
  : devWebDist;
