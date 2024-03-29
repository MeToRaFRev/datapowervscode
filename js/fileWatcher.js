const { uploadFileToDataPower } = require('./datapower.js');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
let fileChangeWatcher;
function startWatching(directory, domain, connectionDetails, dpFolder) {
    if (fileChangeWatcher) {
        fileChangeWatcher.close();
    }

    let timeout = null; // Variable to hold the timeout

    fileChangeWatcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
        if (timeout) {
            clearTimeout(timeout); // Clear the existing timeout if present
        }

        timeout = setTimeout(async () => {
            if (eventType === 'change' && !filename.startsWith('_')) {
                console.log(`Detected save in file: ${filename}`);
                if (hasSyntaxErrors(vscode.Uri.file(path.join(directory, filename)))) {
                    const response = await vscode.window.showErrorMessage(`File ${filename} has syntax errors. do you want to force upload?`, 'Yes', 'No');
                    if (response !== 'Yes')
                        return;
                }
                await uploadFileToDataPower(path.join(directory, filename), domain, connectionDetails, dpFolder);
            } else {
                console.log(`Detected ${eventType} in file: ${filename}`);
            }
        }, 500); // Trigger after 2 seconds of inactivity, assuming it's a save operation
    });
}

function hasSyntaxErrors(uri) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics.some(diagnostic => diagnostic.severity === vscode.DiagnosticSeverity.Error);
}


module.exports = {
    startWatching
};