const { uploadFileToDataPower } = require('./datapower.js');
const fs = require('fs');
const path = require('path');
let fileChangeWatcher;
function startWatching(directory, domain, connectionDetails) {
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
                await uploadFileToDataPower(path.join(directory, filename), domain, connectionDetails);
            } else {
                console.log(`Detected ${eventType} in file: ${filename}`);
            }
        }, 500); // Trigger after 2 seconds of inactivity, assuming it's a save operation
    });
}


module.exports = {
    startWatching
};