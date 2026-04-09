const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send(channel, data) {
            const validChannels = ['write', 'settings', 'refresh', 'export', 'show-save-dialog', 'get-settings'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        on(channel, func) {
            const validChannels = ['connected', 'values', 'error', 'csv', 'export-confirmed', 'settings-data', 'settings-save-result'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
    },
});
