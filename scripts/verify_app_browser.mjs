import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_PORT = 8765;
const DEBUG_PORT = 9223;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROME = process.env.CHROME || "/usr/sbin/google-chrome";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const children = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, { stdio: "ignore", ...options });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Retry until the child process has opened the port.
    }
    await sleep(150);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      this.events.push(message);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime exception");
  }
  return result.result.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await sleep(150);
  }
  throw new Error(`Timeout waiting for expression: ${expression}`);
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(filename, Buffer.from(result.data, "base64"));
  return filename;
}

async function verifyExports() {
  const data = await (await fetch(`${APP_URL}assets/data/app-data.json`)).json();
  for (const info of Object.values(data.exports)) {
    for (const path of [info.csvPath, info.xlsxPath].filter(Boolean)) {
      const response = await fetch(`${APP_URL}${path}`);
      if (!response.ok) throw new Error(`Export ${path} returned ${response.status}`);
      const payload = await response.arrayBuffer();
      if (payload.byteLength < 20) throw new Error(`Export ${path} is unexpectedly small`);
    }
  }
}

async function main() {
  const tempProfile = join(tmpdir(), `mobilanalyse-chrome-${Date.now()}`);
  await mkdir(tempProfile, { recursive: true });

  spawnChild("python3", ["-m", "http.server", String(APP_PORT), "-d", "dist"], {
    cwd: ROOT,
  });
  await waitFor(APP_URL);

  spawnChild(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${tempProfile}`,
    "--window-size=1440,1000",
    APP_URL,
  ]);
  await waitFor(`${DEBUG_URL}/json/version`);
  const pages = await (await fetch(`${DEBUG_URL}/json`)).json();
  const page = pages.find((item) => item.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("Fant ikke Chrome debug target");

  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await waitForExpression(
    cdp,
    "document.querySelectorAll('.chart svg').length >= 2 && !document.querySelector('.kpi')",
  );

  const views = [
    ["overview", "Utvikling i markedsandeler", 2],
    ["segments", "Privatmarkedet", 2],
    ["challengers", "øvrige tilbydere", 1],
    ["prices", "Omsetning per kunde", 1],
    ["totals", "Totalt antall abonnement", 4],
    ["wholesale", "Velg hvem som hører til hvilken grossist", 0],
    ["data", "Excel-eksporter", 0],
  ];
  for (const [view, text, minCharts] of views) {
    await evaluate(cdp, `document.querySelector('[data-view="${view}"]').click()`);
    await waitForExpression(cdp, `document.body.innerText.includes(${JSON.stringify(text)})`);
    const chartCount = await evaluate(cdp, "document.querySelectorAll('.chart svg').length");
    if (chartCount < minCharts) {
      throw new Error(`${view} rendered ${chartCount} charts, expected ${minCharts}`);
    }
  }

  await evaluate(cdp, "document.querySelector('[data-view=\"overview\"]').click()");
  await waitForExpression(cdp, "document.querySelectorAll('[data-method]').length >= 3");
  await evaluate(cdp, "document.querySelector('[data-method=\"market-share\"]').click()");
  await waitForExpression(
    cdp,
    "!!document.querySelector('#method-modal:not([hidden])') && document.body.innerText.includes('Markedsandel') && document.body.innerText.includes(\"dk = 'Mobiltelefoni'\")",
  );
  await evaluate(cdp, "document.querySelector('[data-close-method]').click()");
  await waitForExpression(cdp, "document.querySelector('#method-modal').hidden");
  await evaluate(cdp, "document.querySelector('[data-state=\"metric\"][data-value=\"Omsetning\"]').click()");
  await waitForExpression(cdp, "document.body.innerText.includes('Siste år: omsetning')");
  const pngOk = await evaluate(cdp, "downloadChartPng('chart-1', 'verify-chart.png')");
  if (!pngOk) throw new Error("PNG export did not produce a valid blob");

  await evaluate(cdp, "document.querySelector('[data-view=\"prices\"]').click()");
  for (const mode of ["arpu-provider", "nok-gb", "arpu-segment"]) {
    await evaluate(cdp, `document.querySelector('[data-state="priceMode"][data-value="${mode}"]').click()`);
    await sleep(150);
    const charts = await evaluate(cdp, "document.querySelectorAll('.chart svg path.series-line').length");
    if (charts < 2 && mode !== "arpu-segment") {
      throw new Error(`${mode} rendered too few line series: ${charts}`);
    }
  }
  await evaluate(cdp, "document.querySelector('[data-state=\"priceMode\"][data-value=\"arpu-segment\"]').click()");
  await evaluate(cdp, "document.querySelector('[data-method=\"arpu-segment\"]').click()");
  await waitForExpression(
    cdp,
    "document.body.innerText.includes('gjennomsnittet av to helårssnapshots') && document.body.innerText.includes('ARPU')",
  );
  await evaluate(cdp, "document.querySelector('[data-close-method]').click()");

  await evaluate(cdp, "document.querySelector('[data-view=\"wholesale\"]').click()");
  await waitForExpression(cdp, "document.querySelectorAll('.owner-zone').length === 3");
  await waitForExpression(cdp, "document.querySelectorAll('.ppt-concentration').length === 2");
  await waitForExpression(
    cdp,
    "document.body.innerText.toLowerCase().includes('basert på omsetning') && document.body.innerText.toLowerCase().includes('basert på abonnement')",
  );
  const oldWholesaleText = await evaluate(
    cdp,
    "document.body.innerText.includes('Halvår') || document.body.innerText.includes('Uavhengig') || document.body.innerText.includes('Abonnement sluttbruker')",
  );
  if (oldWholesaleText) {
    throw new Error("Wholesale view still contains old period/independent/mixed concentration text");
  }
  await evaluate(cdp, "document.querySelector('[data-reset-wholesale]').click()");
  await evaluate(cdp, "document.querySelector('[data-state=\"wholesaleYear\"][data-value=\"2025\"]').click()");
  await waitForExpression(cdp, "document.querySelector('[data-provider=\"happybytes\"]')");
  const beforeValues = await evaluate(
    cdp,
    "(() => { const rows = computeWholesaleRows(); return {y2024: rows.find(row => row.ar === 2024 && row.grossist === 'Telia').value, y2025: rows.find(row => row.ar === 2025 && row.grossist === 'Telia').value}; })()",
  );
  await evaluate(
    cdp,
    "wholesaleAssignment['2025']['happybytes'] = 'Telia'; saveWholesaleAssignment(); render();",
  );
  await waitForExpression(cdp, "document.body.innerText.includes('Happybytes')");
  const afterValues = await evaluate(
    cdp,
    "(() => { const rows = computeWholesaleRows(); return {y2024: rows.find(row => row.ar === 2024 && row.grossist === 'Telia').value, y2025: rows.find(row => row.ar === 2025 && row.grossist === 'Telia').value}; })()",
  );
  if (Math.abs(beforeValues.y2025 - afterValues.y2025) < 0.001) {
    throw new Error("Wholesale reassignment did not change 2025 Telia share");
  }
  if (Math.abs(beforeValues.y2024 - afterValues.y2024) > 0.001) {
    throw new Error("Wholesale reassignment leaked into 2024");
  }

  const desktopShot = await screenshot(cdp, "/tmp/mobilanalyse-browser-desktop.png");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitForExpression(
    cdp,
    "!document.querySelector('.kpi') && document.querySelectorAll('.tabs button').length >= 7 && document.querySelectorAll('.chart svg').length >= 2",
  );
  const overflow = await evaluate(
    cdp,
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  if (overflow > 2) throw new Error(`Mobile viewport has horizontal overflow: ${overflow}px`);
  const mobileShot = await screenshot(cdp, "/tmp/mobilanalyse-browser-mobile.png");

  await verifyExports();
  cdp.close();
  console.log(`OK: browser views, controls, exports and mobile layout verified.`);
  console.log(`Screenshots: ${desktopShot}, ${mobileShot}`);
}

try {
  await main();
} finally {
  for (const child of children.reverse()) {
    child.kill("SIGTERM");
  }
}
