const { win, BrowserWindow, app } = require('electron')

function createWindow() {
    const win = new BrowserWindow({
        width: 1980,
        height: 1080,
        backgroundColor: "white",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    })

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);