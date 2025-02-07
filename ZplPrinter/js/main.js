var socketId, clientSocketInfo;
var configs = {};
var retainEntry = null;
var pathEntry = null;
var elID = 0;
var url = null;
$(function () {
    $(window).bind('focus blur', function () {
        $('#panel-head').toggleClass("panel-heading-blur");
    });
});

$(document).ready(function () {
    chrome.storage.local.get(null, function (items) {
        configs = items;
        initConfigs();
        initEvents();
    });

    chrome.sockets.tcp.onReceive.addListener(function (info) {
        
        notify('{0} bytes received from Client: <b>{1}</b> Port: <b>{2}</b>'.format(info.data.byteLength, clientSocketInfo.peerAddress, clientSocketInfo.peerPort), 'print', 'info', 1000);
        var zpls = String.fromCharCode.apply(null, new Uint8Array(info.data)).split(/\^XZ/);
        if (!configs.keepTcpSocket) {
            chrome.sockets.tcp.close(info.socketId);
        }
        var factor = (configs.unit == '1') ? 1 : (configs.unit == '2') ? 2.54 : 25.4;
        var width = parseFloat(configs.width) / factor;
        var height = parseFloat(configs.height) / factor;

        for (var i in zpls) {
            var zpl = zpls[i];
            if(!(!zpl || !zpl.length)) {
                zpl += "^XZ";
            }

            if (configs['saveLabels']) {
                if (configs['filetype'] == '2') {
                    savePdf(zpl, configs.density, width, height);
                }
            }

            console.log(zpl);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://api.labelary.com/v1/printers/{0}dpmm/labels/{1}x{2}/0/'.format(configs.density, width, height), true);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.setRequestHeader("Accept", "application/pdf");

            xhr.responseType = 'blob';
            xhr.onload = function (e) {
                var id = makeid(8);
                if (this.status == 200) {
                    var blob = this.response;
                    if (configs['saveLabels']) {
                        if (configs['filetype'] == '1') {
                            saveLabel(blob, 'pdf');
                        }
                    }
                    var size = getSize(width, height);
                    var labelContainer = document.createElement('div');
                    labelContainer.setAttribute('style','position:relative');
                    labelContainer.setAttribute('id','label_'+id);
                    var textDiv = document.createElement('div');
                    textDiv.setAttribute('id','text_id_'+(id));
                    textDiv.setAttribute('class','textLayer');
                    var img = document.createElement('canvas');
                    img.setAttribute('height', size.height);
                    img.setAttribute('width', size.width);
                    img.setAttribute('class', 'thumbnail');
                    img.setAttribute('id','id_'+(id));
                    img.onload = function (e) {
                        window.URL.revokeObjectURL(url);
                    };

                    var url = window.URL.createObjectURL(blob);
                    $('#label').prepend(labelContainer);
                    $('#label_'+id).prepend(textDiv);
                    $('#label_'+id).prepend(img);
                    var offset = size.height + 20;
                    $('#label').css({ "top": '-' + offset + 'px' });

                    /* start */
                    
                    
                    //
                    // The workerSrc property shall be specified.
                    //
                    var pdfjsLib = window['pdfjs-dist/build/pdf'];
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.js';
                    //
                    // Asynchronous download PDF
                    //
                    var loadingTask = pdfjsLib.getDocument(url);
                    console.log('start');
                    loadingTask.promise.then(function(pdf) {
                      //
                      // Fetch the first page
                      //
                      pdf.getPage(1).then(function(page) {
                        var scale = 2;
                        var viewport = page.getViewport({ scale: scale});
                  
                        //
                        // Prepare canvas using PDF page dimensions
                        //
                        var canvas = document.getElementById('id_'+ id);
                        var context = canvas.getContext('2d');
                        //canvas.height = viewport.height;
                        //canvas.width = viewport.width;
                  
                        //
                        // Render PDF page into canvas context
                        //
                        var renderContext = {
                          canvasContext: context,
                          viewport: viewport,
                        };
                        
                        var renderTask = page.render(renderContext);

                        renderTask.promise.then(function() {
                            // Returns a promise, on resolving it will return text contents of the page
                            return page.getTextContent();
                          }).then(function(textContent) {
                      
                            // Assign CSS to the textLayer element
                            var textLayer = document.getElementById("text_id_"+ id);
                      
                            textLayer.style.left = canvas.offsetLeft + 'px';
                            textLayer.style.top = canvas.offsetTop + 'px';
                            textLayer.style.height = canvas.offsetHeight + 'px';
                            textLayer.style.width = canvas.offsetWidth + 'px';
                      
                            // Pass the data to the method for rendering of text over the pdf canvas.
                            pdfjsLib.renderTextLayer({
                              textContent: textContent,
                              container: textLayer,
                              viewport: viewport,
                              textDivs: []
                            });
                          }).then(function(){
                            $('#label').animate({ "top": "0px" }, 1500);
                            console.log('end');
                            $('#text_id_'+id+' span').on('click',function(){ selectText($(this)[0]); console.log('go'); });
                          });




                        

                      });
                    });

                    /* end */
                    
                }
            };
            xhr.send(zpl);
        }
    });
});

function getSize(width, height) {
    var defaultWidth = 386;

    var factor = width / height;
    return {
        width: defaultWidth,
        height: defaultWidth / factor
    };
}

function saveLabel(blob, ext) {
    chrome.storage.local.get('counter', function (items) {
        chrome.fileSystem.getWritableEntry(pathEntry, function (entry) {
            var counter = parseInt(items.counter);
            var fileName = 'LBL' + pad(counter, 6) + '.' + ext;
            chrome.storage.local.set({ 'counter': ++counter }, function () {
                entry.getFile(fileName, { create: true }, function (entry) {
                    entry.createWriter(function (writer) {
                        writer.write(blob);
                        notify('Label <b>{0}</b> saved in folder <b>{1}</b>'.format(fileName, $('#txt-path').val()), 'floppy-saved', 'info', 1000);

                    });
                });
            });
        });
    });
}

function savePdf(zpl, density, width, height) {
    console.log(density);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://api.labelary.com/v1/printers/{0}dpmm/labels/{1}x{2}/0/'.format(density, width, height), true);
    xhr.setRequestHeader('Accept', 'application/pdf');
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.responseType = 'blob';
    xhr.onload = function (e) {
        if (this.status == 200) {
            saveLabel(this.response, 'pdf');
        }
    };

    xhr.send(zpl);
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

// Display notification
// @param {String} text Notification text
// @param {Number} glyphicon Notification icon
// @param {String} type Notification type
// @param {Number} delay Notification fade out delay in ms
function notify(text, glyphicon, type, delay) {
    var log = $('<p>' + text + '</p>').text();
    if (type == 'danger')
        console.error(log);
    else {
        console.info(log);
    }

    $('.bottom-left').notify({
        message: { html: text },
        glyphicon: glyphicon,
        type: type,
        fadeOut: {
            delay: delay == undefined ? 2000 : delay
        }
    }).show();
}

// Start tcp server and listen on configuret host/port
function startTcpServer() {
    if (socketId != undefined) return;
    chrome.sockets.tcpServer.create({}, function (info) {
        socketId = info.socketId;
        chrome.sockets.tcpServer.listen(socketId, configs.host, parseInt(configs.port), 20, function (result) {
            if (result == 0) {
                notify('Printer started on Host: <b>{0}</b> Port: <b>{1}</b>'.format(configs.host, configs.port));
                chrome.sockets.tcpServer.onAccept.addListener(function (clientInfo) {
                    chrome.sockets.tcp.getInfo(clientInfo.clientSocketId, function (socketInfo) {
                        clientSocketInfo = socketInfo;
                        chrome.sockets.tcp.update(clientInfo.clientSocketId,{bufferSize: parseInt(configs.bufferSize) }, function(){
                            chrome.sockets.tcp.setPaused(clientInfo.clientSocketId, false);
                        });
                    });
                });
            } else {
                socketId = undefined;
                toggleSwitch('.btn-toggle');
                notify('Error occurs while creating Printer on Host: <b>{0}</b> Port: <b>{1}</b>'.format(configs.host, configs.port), 'exclamation-sign', 'danger', 4000);
            }
        });
    });
}

// Stop tcp server
function stopTcpServer() {
    if (socketId == undefined) return;
    chrome.sockets.tcpServer.close(socketId, function () {
        notify('Printer stopped on <b>{0}</b> Port: <b>{1}</b>'.format(configs.host, configs.port));
        socketId = undefined;
    });
}

// Init ui events
function initEvents() {
    $('.btn-toggle').click(function () {
        toggleSwitch(this);

        if ($('#btn-on').hasClass('active')) {
            startTcpServer();
        } else {
            stopTcpServer();
        }
    });

    $('#btn-remove').click(function () {
        var size = $('.thumbnail').size();

        if (size > 0) {
            var label = size == 1 ? 'label' : 'labels';
            bootbox.confirm('Are you sure to remove {0} {1}?'.format(size, label), function (result) {
                if (result) {
                    $('.thumbnail').remove();
                    notify('{0} {1} successfully removed.'.format(size, label), 'trash', 'info');
                }
            });
        }
    });

    $('#panel-head').click(function(){
        var win = chrome.app.window.current();
        win.innerBounds.height = win.innerBounds.height == 40 ? 768 : 40; 
    });

    $('#btn-close').click(function () {
        chrome.storage.local.set({ isOn: $('#btn-on').hasClass('active') }, function () {
            window.close();
            stopTcpServer();
        });
    });

    $('#density li > a').click(function () {
        var btn = $('#btn-density');
        btn.attr('aria-valuenow', $(this).parent().attr('aria-valuenow'));
        btn.html($(this).text() + ' <span class="caret"></span>');
    });

    $('#unit li > a').click(function () {
        var btn = $('#btn-unit');
        btn.attr('aria-valuenow', $(this).parent().attr('aria-valuenow'));
        btn.html($(this).text() + ' <span class="caret"></span>');
    });

    $('#filetype li > a').click(function () {
        var btn = $('#btn-filetype');
        btn.attr('aria-valuenow', $(this).parent().attr('aria-valuenow'));
        btn.html($(this).text() + ' <span class="caret"></span>');
    });

    $("#txt-path").keydown(function (e) {
        e.preventDefault();
    });

    $('#configsForm').submit(function (e) {
        e.preventDefault();
        saveConfigs();

    });

    $('#settings-window').on('shown.bs.modal', function () {
        if ($('#btn-on').hasClass('active')) {
            toggleSwitch('.btn-toggle');
            stopTcpServer();
        }
    });

    $('#ckb-saveLabels').change(function () {
        var disabled = !$(this).is(':checked');
        $('#btn-filetype').prop('disabled', disabled);
        $('#btn-path').prop('disabled', disabled);
        $('#txt-path').prop('disabled', disabled);
    });

    $('#btn-path').click(function () {
        chrome.fileSystem.chooseEntry({
            type: 'openDirectory',
        }, function (entry) {
            if (chrome.runtime.lastError) {
                console.info(chrome.runtime.lastError.message);
            } else {
                initPath(entry);
                pathEntry = entry;
                retainEntry = chrome.fileSystem.retainEntry(entry);
            }
        });
    });

}

// Toggle on/off switch
// @param {Dom Object} btn Button group to toggle
function toggleSwitch(btn) {
    $(btn).find('.btn').toggleClass('active');

    if ($(btn).find('.btn-primary').size() > 0) {
        $(btn).find('.btn').toggleClass('btn-primary');
    }

    $(btn).find('.btn').toggleClass('btn-default');
}

// Svae configs in local storage
function saveConfigs() {
    for (var key in configs) {
        if (key == 'density') {
            configs[key] = $('#btn-density').attr('aria-valuenow');
        } else if (key == 'unit') {
            configs[key] = $('#btn-unit').attr('aria-valuenow');
        } else if (key == 'filetype') {
            configs[key] = $('#btn-filetype').attr('aria-valuenow');
        } else if (key == 'saveLabels') {
            configs[key] = $('#ckb-saveLabels').is(':checked');
        } else if (key == 'keepTcpSocket') {
            configs[key] = $('#ckb-keep-tcp-socket').is(':checked');
        } else if (key == 'path') {
            configs[key] = retainEntry
        } else {
            configs[key] = $('#' + key).val();
        }
    }

    chrome.storage.local.set(configs, function () {
        $('#settings-window').modal('hide');
        notify('Printer settings changes successfully saved', 'cog', 'info');
    });
}

// Init/load configs from local storage
function initConfigs() {
    for (var key in configs) {
        if (key == 'density') {
            initDropDown('density', configs[key]);
        } else if (key == 'unit') {
            initDropDown('unit', configs[key]);
        } else if (key == 'filetype') {
            initDropDown('filetype', configs[key]);
        } else if (key == 'saveLabels') {
            $('#ckb-saveLabels').prop('checked', configs[key]);
            var disabled = !configs[key];
            $('#btn-filetype').prop('disabled', disabled);
            $('#btn-path').prop('disabled', disabled);
            $('#txt-path').prop('disabled', disabled);
        } else if (key == 'isOn' && configs[key]) {
            toggleSwitch('.btn-toggle');
            startTcpServer();
        } else if (key == 'keepTcpSocket') {
            $('#ckb-keep-tcp-socket').prop('checked', configs[key]);
        } else if (key == 'path' && configs[key]) {
            retainEntry = configs[key];
            chrome.fileSystem.restoreEntry(configs[key], function (entry) {
                pathEntry = entry;
                initPath(entry);
            });
        }
        else {
            $('#' + key).val(configs[key]);
        }
    }
}

function initPath(entry) {
    chrome.fileSystem.getDisplayPath(entry, function (path) {
        $('#txt-path').val(path);
    });
}

function initDropDown(btnId, value) {
    var btn = $('#btn-' + btnId);
    var text = $('#' + btnId).find('li[aria-valuenow=' + value + '] > a').html();
    btn.attr('aria-valuenow', value);
    btn.html(text + ' <span class="caret"></span>');
}

// Prototype for string.format method
String.prototype.format = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};


function selectText(node) {
    //node = document.getElementById(node);

    if (document.body.createTextRange) {
        const range = document.body.createTextRange();
        range.moveToElementText(node);
        range.select();
        document.execCommand("copy");
    } else if (window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("copy");
    } else {
        console.warn("Could not select text in node: Unsupported browser.");
    }
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }