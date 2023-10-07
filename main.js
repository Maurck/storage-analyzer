const { BrowserWindow, app } = require('electron')

function createWindow() {
    new BrowserWindow({
        width: 1980,
        height: 1080,
        backgroundColor: "white",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    }).loadFile('index.html').then(ignored => {});
}

app.whenReady().then(createWindow);