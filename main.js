const { win, BrowserWindow, app } = require('electron')

function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 720,
        backgroundColor: "white",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    })

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);