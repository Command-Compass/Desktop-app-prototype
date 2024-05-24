// main.js (additional code)
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
let pyProc = null;
const imports = require("./importForMain");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(imports.index);
}

app.whenReady().then(() => {
  createWindow();

  // Start Python server
  const serverPath = path.join(__dirname, "../../backend/server.py");
  pyProc = spawn("python", [serverPath]);

  pyProc.stdout.on("data", (data) => {
    console.log(`Python server output: ${data}`);
  });

  pyProc.stderr.on("data", (data) => {
    console.error(`Python server error: ${data}`);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("quit", () => {
  if (pyProc !== null) {
    pyProc.kill();
  }
});

ipcMain.on("execute-command", (event, command) => {
  const request = require("request");
  request.post(
    "http://127.0.0.1:5000/execute",
    {
      json: { command: command },
    },
    (error, response, body) => {
      if (error) {
        console.error("Error:", error);
        event.reply("command-output", `Error: ${error.message}`);
      } else if (response.statusCode !== 200) {
        console.error("Error:", body.error);
        event.reply("command-output", `Error: ${body.error}`);
      } else {
        event.reply("command-output", body.output || body.error);
      }
    }
  );
});
