// Trendline Desk: an always-on-top window that reads a ticker's live price and
// daily history, then runs the trend/pattern analysis in analysis.js.
const { app, BrowserWindow, ipcMain, globalShortcut, net, screen, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { parseChart } = require("./feed");

const TOGGLE_SHORTCUT = "CommandOrControl+Shift+Y";
const COMPACT_HEIGHT = 196;
let win = null;
let prefs = {};

const prefsFile = () => path.join(app.getPath("userData"), "prefs.json");
function loadPrefs() {
  try { return JSON.parse(fs.readFileSync(prefsFile(), "utf8")) || {}; } catch { return {}; }
}
function savePrefs() {
  try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2)); } catch { /* read-only disk: keep going */ }
}

// Drop a saved position that is no longer on any connected display.
function usableBounds(b) {
  const def = { width: 420, height: 800 };
  if (!b || !b.width || !b.height) return def;
  if (b.x == null || b.y == null) return { width: b.width, height: b.height };
  const onScreen = screen.getAllDisplays().some(({ workArea: w }) =>
    b.x + 60 > w.x && b.x < w.x + w.width - 60 && b.y >= w.y - 10 && b.y < w.y + w.height - 40);
  return onScreen ? b : { width: b.width, height: b.height };
}

function createWindow() {
  prefs = loadPrefs();
  const onTop = prefs.onTop !== false;
  win = new BrowserWindow({
    ...usableBounds(prefs.bounds),
    minWidth: 340,
    minHeight: 150,
    frame: false,
    alwaysOnTop: onTop,
    backgroundColor: "#0E131A",
    title: "Trendline Desk",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // "floating" keeps it above normal app windows, including most broker platforms.
  if (onTop) win.setAlwaysOnTop(true, "floating");
  if (prefs.opacity) win.setOpacity(prefs.opacity);
  win.loadFile(path.join(__dirname, "overlay.html"));

  const saveBounds = () => {
    if (!win || win.isMinimized()) return;
    const b = win.getBounds();
    // Remember the expanded height separately so compact mode doesn't overwrite it.
    prefs.bounds = prefs.compact ? { ...b, height: (prefs.bounds && prefs.bounds.height) || 800 } : b;
    savePrefs();
  };
  win.on("moved", saveBounds);
  win.on("resized", saveBounds);
  win.on("closed", () => { win = null; });

  // Open external links in the default browser, never inside the overlay.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());

  if (prefs.compact) applyCompact(true);
}

function applyCompact(on) {
  if (!win) return;
  const b = win.getBounds();
  if (on) {
    win.setBounds({ ...b, height: COMPACT_HEIGHT });
  } else {
    const h = (prefs.bounds && prefs.bounds.height) || 800;
    win.setBounds({ ...b, height: Math.max(h, 420) });
  }
}

/* ---------- market data (Yahoo Finance chart endpoint) ---------- */
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

async function fetchHistory(symbol) {
  const sym = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9.\-^=]/g, "");
  if (!sym) return { ok: false, error: "Type a ticker symbol first." };
  let lastErr = null;
  for (const host of HOSTS) {
    const url = `${host}/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d&includePrePost=false&events=div%2Csplit`;
    try {
      const res = await net.fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 404 || (json && json.chart && json.chart.error && json.chart.error.code === "Not Found")) {
        return { ok: false, error: `"${sym}" wasn't found. Check the symbol. Non-US listings use a suffix, e.g. SHOP.TO or VOD.L.` };
      }
      if (!res.ok) { lastErr = new Error(`The price feed answered ${res.status}.`); continue; }
      return { ok: true, ...parseChart(json) };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, error: (lastErr && lastErr.message) || "Couldn't reach the price feed. Check your internet connection." };
}

/* ---------- IPC ---------- */
ipcMain.handle("history", (_e, symbol) => fetchHistory(symbol));
ipcMain.handle("prefs:get", () => prefs.ui || {});
ipcMain.handle("prefs:set", (_e, ui) => { prefs.ui = ui; savePrefs(); });
ipcMain.handle("win:state", () => ({ onTop: prefs.onTop !== false, opacity: prefs.opacity || 1, compact: !!prefs.compact, shortcut: TOGGLE_SHORTCUT }));
ipcMain.handle("win:onTop", (_e, on) => { prefs.onTop = !!on; savePrefs(); if (win) win.setAlwaysOnTop(!!on, "floating"); });
ipcMain.handle("win:opacity", (_e, v) => { const o = Math.min(1, Math.max(0.35, +v || 1)); prefs.opacity = o; savePrefs(); if (win) win.setOpacity(o); });
ipcMain.handle("win:compact", (_e, on) => { prefs.compact = !!on; savePrefs(); applyCompact(!!on); });
ipcMain.handle("win:minimize", () => win && win.minimize());
ipcMain.handle("win:close", () => win && win.close());

app.whenReady().then(() => {
  createWindow();
  try {
    globalShortcut.register(TOGGLE_SHORTCUT, () => {
      if (!win) return createWindow();
      if (win.isVisible() && win.isFocused()) win.hide(); else { win.show(); win.focus(); }
    });
  } catch { /* shortcut taken by another app; the window still works */ }
  app.on("activate", () => { if (!win) createWindow(); });
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
