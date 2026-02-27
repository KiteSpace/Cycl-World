import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const line = JSON.stringify(req.body) + "\n";
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line);
    res.status(204).end();
  } else {
    res.status(405).end();
  }
}
