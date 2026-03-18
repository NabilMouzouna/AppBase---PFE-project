import fs from "node:fs";
import path from "node:path";

export function ensureParentDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
