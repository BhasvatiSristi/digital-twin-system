import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let backendProcess = null;

const isDev = !app.isPackaged;

function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, "../backend-dist/conversion_server.exe")
    : path.join(process.resourcesPath, "backend", "conversion_server.exe");

  console.log("Starting backend:", backendPath);

  backendProcess = spawn(backendPath, [], {
    windowsHide: true,
  });

  backendProcess.stdout?.on("data", (data) => {
    console.log(`[Backend] ${data}`);
  });

  backendProcess.stderr?.on("data", (data) => {
    console.error(`[Backend] ${data}`);
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
  });

  backendProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});