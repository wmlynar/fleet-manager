const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealthy(baseUrl, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`);
      if (response.ok) {
        const json = await response.json();
        if (json && json.ok === true) {
          return;
        }
      }
    } catch (err) {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become healthy in time.");
}

async function fetchText(baseUrl, pathName) {
  const response = await fetchWithTimeout(`${baseUrl}${pathName}`);
  assert.ok(response.ok, `Expected ${pathName} to be OK`);
  return response.text();
}

async function fetchJson(baseUrl, pathName) {
  const response = await fetchWithTimeout(`${baseUrl}${pathName}`);
  assert.ok(response.ok, `Expected ${pathName} to be OK`);
  return response.json();
}

async function run() {
  const port = await getFreePort();
  const roboshopPort = await getFreePort();
  const env = {
    ...process.env,
    PORT: String(port),
    ROBOSHOP_PORT: String(roboshopPort),
    ROBOSHOP_BIND_HOST: "127.0.0.1"
  };
  const server = spawn("node", ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverExited = false;
  server.on("exit", (code) => {
    serverExited = true;
    if (code && code !== 0) {
      process.stderr.write(`Server exited with code ${code}\n`);
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealthy(baseUrl);

    const health = await fetchJson(baseUrl, "/health");
    assert.equal(health.ok, true, "Health endpoint should return ok=true");

    const html = await fetchText(baseUrl, "/");
    assert.ok(html.includes('id="login-form"'), "Login form should exist");
    assert.ok(html.includes('data-view="map"'), "Map nav item should exist");
    assert.ok(html.includes('data-view="packaging"'), "Packaging nav item should exist");
    assert.ok(html.includes('id="view-packaging"'), "Packaging view should exist");
    assert.ok(html.includes("packaging_engine.js"), "Packaging engine script should load");

    const css = await fetchText(baseUrl, "/styles.css");
    assert.ok(css.includes(".shell"), "Styles should include shell layout");
    assert.ok(css.includes(".map"), "Styles should include map layout");

    const appJs = await fetchText(baseUrl, "/app.js");
    assert.ok(appJs.includes('const SESSION_KEY = "fleetManagerSession"'), "App JS should load");

    const engineJs = await fetchText(baseUrl, "/packaging_engine.js");
    assert.ok(engineJs.includes("PackagingEngine"), "Packaging engine should load");

    const packaging = await fetchJson(baseUrl, "/data/packaging.json");
    assert.ok(Array.isArray(packaging.buffers), "Packaging buffers should be an array");
    assert.ok(Array.isArray(packaging.streams), "Packaging streams should be an array");
    assert.ok(Array.isArray(packaging.lines), "Packaging lines should be an array");

    const graph = await fetchJson(baseUrl, "/data/graph.json");
    assert.ok(Array.isArray(graph.nodes), "Graph nodes should be an array");
    assert.ok(Array.isArray(graph.edges), "Graph edges should be an array");
  } finally {
    if (!serverExited) {
      server.kill("SIGTERM");
    }
  }
}

run()
  .then(() => {
    console.log("E2E UI smoke ok.");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
