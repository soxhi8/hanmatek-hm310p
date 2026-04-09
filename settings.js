const ipc = globalThis.electron.ipcRenderer;

// Request current settings when window opens
ipc.send('get-settings');

// Populate input when settings data is received
ipc.on('settings-data', data => {
    if (data && typeof data.port === 'string') {
        document.querySelector('#port').value = data.port;
    }
});

ipc.on('settings-save-result', data => {
    if (data?.ok) {
        globalThis.close();
    }
});

document.querySelector('#close').addEventListener('click', () => {
    const portValue = document.querySelector('#port').value;
    ipc.send('settings', {port: portValue});
});
