chrome.app.runtime.onLaunched.addListener(function () {
    chrome.app.window.create('main.html', {
        frame: 'none',
        bounds: {
            width: 450,
            height: 768
        },
        resizable: false,
    });
});

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install" || details.reason == "update") {
        chrome.storage.local.set({
            isOn: true,
            density: '8',
            width: '2.5',
            height: '1.5',
            unit: '1',
            host: '127.0.0.1',
            port: '9100',
            bufferSize: '4096',
            keepTcpSocket: false,
            saveLabels: false,
            filetype: '1',
            path: null,
	    counter: 0
        });
    }
});