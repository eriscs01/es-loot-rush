import Client from "ssh2-sftp-client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const square = "\u25a0";

function log(message) {
  const now = new Date();
  const timestamp = chalk.gray(`[${now.toLocaleTimeString()}]`);
  console.log(timestamp, chalk.green(square), message);
}

function logError(message, error) {
  const now = new Date();
  const timestamp = chalk.gray(`[${now.toLocaleTimeString()}]`);
  console.error(timestamp, chalk.redBright("x"), message);
  if (error) {
    console.error(timestamp, chalk.redBright("x"), chalk.yellow(error.stack || error.message || error));
  }
}

const sftp = new Client();

const config = {
  host: process.env.SFTP_HOST,
  port: process.env.SFTP_PORT ? parseInt(process.env.SFTP_PORT) : 22,
  username: process.env.SFTP_USER,
  password: process.env.SFTP_PASSWORD,
};

const localBPScriptDir = path.join(__dirname, "dist");
const localBPManifestDir = path.join(__dirname, "/behavior_packs/", process.env.PROJECT_NAME);
const remoteBPDir = process.env.SFTP_WORLD_PATH + "/behavior_packs/" + process.env.PROJECT_NAME;
const localRPDir = path.join(__dirname, "/resource_packs/", process.env.PROJECT_NAME);
const remoteRPDir = process.env.SFTP_WORLD_PATH + "/resource_packs/" + process.env.PROJECT_NAME;

async function uploadDir(local, remote) {
  const items = fs.readdirSync(local);
  for (const item of items) {
    const localPath = path.join(local, item);
    const remotePath = remote + "/" + item;
    if (fs.lstatSync(localPath).isDirectory()) {
      try {
        await sftp.mkdir(remotePath, true);
      } catch (e) {}
      await uploadDir(localPath, remotePath);
    } else {
      log(`Uploading ${localPath} -> ${remotePath}`);
      await sftp.put(localPath, remotePath);
    }
  }
}

sftp
  .connect(config)
  .then(async () => {
    log("started 'sftp-upload'");
    return Promise.all([
      uploadDir(localBPManifestDir, remoteBPDir),
      uploadDir(localBPScriptDir, remoteBPDir),
      uploadDir(localRPDir, remoteRPDir),
    ]);
  })
  .then(() => {
    log("finished 'sftp-upload'");
    return sftp.end();
  })
  .catch((err) => {
    logError("Error:", err);
    process.exit(1);
  });
