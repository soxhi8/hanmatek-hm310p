import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import {
    app,
    BrowserWindow,
    Menu,
    dialog,
    ipcMain,
} from 'electron';
import storage from 'electron-json-storage';
import windowStateKeeper from 'electron-window-state';
import Hm310 from './lib/hm310.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

let mainWindow;
let settingsWindow;

const isDev = !app.isPackaged;
const chartData = {};

let hm310;
let port;
let lastError;

const menuTemplate = [
    {
        label: 'Edit',
        submenu: [
            {role: 'undo'},
            {role: 'redo'},
            {type: 'separator'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {role: 'selectAll'},
        ],
    },
    {
        label: 'Tools',
        submenu: [
            {
                label: 'Export CSV',
                click() {
                    exportCsv();
                },
            },
            {
                label: 'Settings',
                click() {
                    settings();
                },
            },
        ],
    },
];

if (process.platform === 'darwin') {
    menuTemplate.unshift({
        label: 'HM310P',
        submenu: [
            {role: 'about'},
            {type: 'separator'},
            {role: 'services'},
            {type: 'separator'},
            {role: 'hide'},
            {role: 'hideOthers'},
            {role: 'unhide'},
            {type: 'separator'},
            {role: 'quit'},
        ],
    });
}

function connect() {
    console.log('connect!');

    if (hm310) {
        try {
            hm310.close();
        } catch {}

        hm310.removeAllListeners();
    }

    storage.get('port', (error, data) => {
        const storedPort = normalizePortSetting(data);

        if (error || !storedPort) {
            const err = 'Serial Port not defined';
            console.log(err);
            if (mainWindow) {
                mainWindow.webContents.send('error', err);
            }

            lastError = err;
            return;
        }

        port = storedPort;

        hm310 = new Hm310({
            port,
        });

        hm310.on('connected', val => {
            console.log('connected', val);
            if (mainWindow) {
                mainWindow.webContents.send('connected', val);
            }
        });

        hm310.on('value', (key, val, timestamp) => {
            if (['voltage', 'current', 'power', 'setVoltage', 'setCurrent'].includes(key)) {
                chartData[timestamp] ||= {};
                chartData[timestamp][key] = val;
            }

            if (mainWindow) {
                mainWindow.webContents.send('values', {key, val});
            }
        });

        hm310.on('error', error => {
            console.error(error);
            lastError = error.message;

            if (mainWindow) {
                mainWindow.webContents.send('error', error.message);
                if (error.errno === 'ECONNREFUSED') {
                    mainWindow.webContents.send('connected', false);
                    hm310.connected = false;
                }
            }
        });
    });
}

app.on('ready', () => {
    createWindow();
    connect();
});

ipcMain.on('get-settings', event => {
    storage.get('port', (error, data) => {
        event.reply('settings-data', {port: normalizePortSetting(data)});
    });
});

ipcMain.on('settings', (event, data) => {
    const portValue = typeof data.port === 'string' ? data.port.trim() : '';

    storage.set('port', portValue, error => {
        if (error) {
            if (mainWindow) {
                mainWindow.webContents.send('error', error.message);
            }

            event.reply('settings-save-result', {ok: false, error: error.message});
            return;
        }

        connect();
        event.reply('settings-save-result', {ok: true, port: portValue});
    });
});

ipcMain.on('refresh', () => {
    if (!mainWindow) {
        return;
    }

    mainWindow.webContents.send('connected', hm310 ? hm310.connected : false);
    if ((!hm310 || !hm310.connected) && lastError) {
        mainWindow.webContents.send('error', lastError);
    }

    if (hm310 && hm310.values) {
        for (const key of Object.keys(hm310.values)) {
            mainWindow.webContents.send('values', {key, val: hm310.values[key]});
        }
    }
});

ipcMain.on('write', (event, data) => {
    if (hm310) {
        hm310.write(data.key, data.val);
    }
});

ipcMain.on('show-save-dialog', async event => {
    const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Export CSV',
        filters: [
            {name: 'Comma Separated Values', extensions: ['csv']},
        ],
    });

    if (res && res.filePath && !res.canceled) {
        event.reply('export-confirmed', res.filePath);
    }
});

ipcMain.on('export', (event, file) => {
    const content = 'timestamp;voltage;current;power;setVoltage;setCurrent\n'
        + Object.keys(chartData).map(timestamp => [
            timestamp,
            chartData[timestamp].voltage ?? '',
            chartData[timestamp].current ?? '',
            chartData[timestamp].power ?? '',
            chartData[timestamp].setVoltage ?? '',
            chartData[timestamp].setCurrent ?? '',
        ].join(';')).join('\n');

    fs.writeFile(file, content, error => {
        if (error) {
            console.error('Export failed:', error);
        } else {
            console.log('wrote', file);
        }
    });
});

function createWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1366,
        defaultHeight: 768,
    });

    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindowState.manage(mainWindow);

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true,
    }));

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

function settings() {
    settingsWindow = new BrowserWindow({
        width: 800,
        height: 400,
        show: false,
        modal: true,
        parent: mainWindow,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    settingsWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'settings.html'),
        protocol: 'file:',
        slashes: true,
    }));

    settingsWindow.show();
    if (isDev) {
        settingsWindow.webContents.openDevTools();
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function exportCsv() {
    if (mainWindow) {
        mainWindow.webContents.send('csv');
    }
}

function normalizePortSetting(value) {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value && typeof value.port === 'string') {
        return value.port.trim();
    }

    return '';
}
