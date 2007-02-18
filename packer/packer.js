/*
    packer, version 2.0.2 (2005-08-19)
    Copyright 2004-2005, Dean Edwards
    License: http://creativecommons.org/licenses/LGPL/2.1/
*/
var input, output;
onload = function() {
    if (!document.getElementById || ''.replace(/^/, String)) return;

    input = document.getElementById("input");
    output = document.getElementById("output");

    var message = document.getElementById("message");
    var encoding = document.getElementById("ascii-encoding");
    var fastDecode = document.getElementById("fast-decode");
    var specialChars = document.getElementById("special-chars");

    function packScript() {
    try {
        if (input.value) {
            output.value = pack(input.value, encoding.value, fastDecode.checked, specialChars.checked);
            calculateRatio();
            disableDecode(!output.value || encoding.value == 0);
        }
    } catch ($error) {
        reportError("error packing script", $error.message);
    }};

    function decodeScript() {
    try {
        if (output.value) {
            eval("output.value=String" + output.value.slice(4));
            calculateRatio();
        }
    } catch ($error) {
        reportError("error decoding script", $error.message);
    } finally {
        decodeScript.button.blur();
        disableDecode(true);
    }};

    function loadScript() {
        var uploadScript = document.getElementById("uploadScript");
        uploadScript.style.display = "inline";
        uploadScript.disabled = false;
        this.style.display = "none";
    };

    function uploadScript() {
        packer.encoding = "multipart/form-data";
        packer.command.value = "load";
        packer.submit();
    };

    function saveScript() {
        packer.command.value = "save";
    };

    function clearAll(loading) {
        if (loading != true) {
            packer.filetype.value = "";
            packer.filename.value = "";
            input.value = "";
        }
        output.value = "";
        message.firstChild.nodeValue = "ready";
        message.className = "";
        input.focus();
        disableDecode(true);
        enableFastDecode();
    };

    function disableDecode(disabled) {
        decodeScript.button.disabled = disabled;
        saveScript.button.disabled = !output.value;
    };

    function enableFastDecode() {
        fastDecode.disabled = Boolean(encoding.value == 0);
        fastDecode.parentNode.className = (encoding.value == 0) ? "disabled" : "";
    };

    function calculateRatio() {
        var calc = output.value.length + "/" + input.value.length;
        var result = Number(eval(calc));
        var ratio = result.toFixed ? result.toFixed(3) : result;
        message.firstChild.nodeValue = "compression ratio: " + calc + "=" + ratio;
        message.className = "";
    };

    function reportError($message, $error) {
        message.innerHTML = $message + ($error ? ": " + $error : "");
        message.className = "error";
    };

    // assign event handlers
    encoding.onclick = enableFastDecode;
    var buttons = document.getElementsByTagName("button");
    var button, i;
    for (i = 0; (button = buttons[i]); i++) {
        var handler = eval(button.id);
        button.onclick = handler;
        handler.button = button;
    }
    document.getElementById("uploadScript").onchange = uploadScript;

    // enable the form
    fastDecode.checked = true; // moz bug :-(
    var packer = document.forms[0];
    packer.className = "";

    // autofocus
    clearAll(true);
};
