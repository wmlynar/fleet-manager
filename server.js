const fs = require("fs");
const path = require("path");
const express = require("express");

const { RdsHttpClient } = require("../shared/rds_http_client");

const app = express();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const roboshopPort = Number.parseInt(process.env.ROBOSHOP_PORT || "8088", 10);
const roboshopBindHost = process.env.ROBOSHOP_BIND_HOST || "0.0.0.0";
const rdsHost = process.env.RDS_HOST || "127.0.0.1";
const rdsPort = Number.parseInt(process.env.RDS_PORT || "8088", 10);
const rdsTimeoutMs = Number.parseInt(process.env.RDS_TIMEOUT_MS || "5000", 10);
const rdsMaxBodyLength = Number.parseInt(process.env.RDS_MAX_BODY_LENGTH || "10485760", 10);
const rdsUploadDir = process.env.RDS_UPLOAD_DIR
  ? path.resolve(process.env.RDS_UPLOAD_DIR)
  : null;
const rdsSceneZipPath = process.env.RDS_SCENE_ZIP_PATH
  ? path.resolve(process.env.RDS_SCENE_ZIP_PATH)
  : null;

const rds = new RdsHttpClient({
  host: rdsHost,
  port: rdsPort,
  timeoutMs: rdsTimeoutMs,
  maxBodyLength: rdsMaxBodyLength
});

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Fleet manager running at http://localhost:${port}`);
});

const roboshop = express();
roboshop.use(
  express.raw({
    type: "*/*",
    limit: rdsMaxBodyLength
  })
);

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function parseJsonBody(req) {
  if (!req.body || !req.body.length) {
    return null;
  }
  const text = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
  return JSON.parse(text);
}

function maybeSaveUpload(buffer) {
  if (!rdsUploadDir) {
    return null;
  }
  fs.mkdirSync(rdsUploadDir, { recursive: true });
  const fileName = `upload-scene-${Date.now()}.zip`;
  const filePath = path.join(rdsUploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

roboshop.post("/getProfiles", async (req, res) => {
  try {
    const body = parseJsonBody(req) || {};
    const file = body.file || "properties.json";
    const response = await rds.getProfiles(file);
    return sendJson(res, response.statusCode || 200, response.body || {});
  } catch (err) {
    return sendJson(res, 500, { error: "proxy_failed", message: err.message });
  }
});

roboshop.get("/robotsStatus", async (req, res) => {
  try {
    const devicesParam = req.query.devices || "";
    const devices = String(devicesParam)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const response = await rds.getRobotsStatus(devices.length ? devices : undefined);
    return sendJson(res, response.statusCode || 200, response.body || {});
  } catch (err) {
    return sendJson(res, 500, { error: "proxy_failed", message: err.message });
  }
});

roboshop.get("/downloadScene", async (_req, res) => {
  try {
    if (rdsSceneZipPath && fs.existsSync(rdsSceneZipPath)) {
      const buffer = fs.readFileSync(rdsSceneZipPath);
      res.status(200).type("application/zip").send(buffer);
      return;
    }
    const response = await rds.downloadScene();
    res.status(response.statusCode || 200).type("application/zip").send(response.body || Buffer.alloc(0));
  } catch (err) {
    res.status(500).json({ error: "proxy_failed", message: err.message });
  }
});

roboshop.post("/uploadScene", async (req, res) => {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const savedPath = maybeSaveUpload(buffer);
    const response = await rds.uploadScene(buffer);
    const payload = Object.assign({}, response.body || {});
    if (savedPath) {
      payload.saved_path = savedPath;
    }
    return sendJson(res, response.statusCode || 200, payload);
  } catch (err) {
    return sendJson(res, 500, { error: "proxy_failed", message: err.message });
  }
});

roboshop.listen(roboshopPort, roboshopBindHost, () => {
  console.log(`Roboshop API proxy listening on http://${roboshopBindHost}:${roboshopPort}`);
  console.log(`RDS upstream: http://${rdsHost}:${rdsPort}`);
  console.log(`RDS upload dir: ${rdsUploadDir || "disabled"}`);
  console.log(`RDS scene zip: ${rdsSceneZipPath || "upstream"}`);
});
