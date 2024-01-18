//TODO : Upload full folder
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
async function uploadFileToDataPower(filePath, domain, connectionDetails, dpFolder) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Uploading file to DataPower",
        cancellable: false
    }, async (progress) => {
        const fileName = path.basename(filePath);
        let fileContent;
        console.log(`Uploading file ${fileName} to DataPower`);
        progress.report({ message: `Reading file ${fileName}` });
        try {
            fileContent = fs.readFileSync(filePath);
        } catch (error) {
            progress.report({ message: `Deleting file ${fileName}` });
            const deletedFileResponse = await axios.delete(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, {
                headers: {
                    'Authorization': `Basic ${connectionDetails.authorization}`
                }
            });
            if (/^2.*/.test(deletedFileResponse.status)) {
                progress.report({ message: `File ${fileName} deleted successfully!`, increment: 100 });
            } else {
                progress.report({ message: `Failed to delete file ${fileName}` });
            }
            return;
        }
        try {
            progress.report({ message: `Checking if file ${fileName} exists in ${dpFolder}` });
            console.log(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`)
            const fileExistsResponse = await axios.get(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, {
                headers: {
                    'Authorization': `Basic ${connectionDetails.authorization}`
                }
            });
            console.log({ fileExistsResponse })
            if (fileExistsResponse.status === 200) {
                progress.report({ message: `File ${fileName} exists in ${dpFolder}` });
                // if file exists check if there is a folder in the workspace with the date of today
                // if not create one and put the current file in it
                progress.report({ message: `Checking if backup folder for date ${new Date().toISOString().slice(0, 10)} exists` });
                if (!fs.existsSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`))) {
                    progress.report({ message: `Creating backup folder for date ${new Date().toISOString().slice(0, 10)}` });
                    fs.mkdirSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`));
                    progress.report({ message: `Backup folder for date ${new Date().toISOString().slice(0, 10)} created successfully!` });
                }
                if (!fs.existsSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`, `_${fileName}`))) {
                    progress.report({ message: `Creating backup of file ${fileName}` });
                    //this is base64 to string
                    const fileContent = Buffer.from(fileExistsResponse.data.file, 'base64').toString('utf-8');
                    fs.writeFileSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`, `_${fileName}`), fileContent);
                    progress.report({ message: `Backup of file ${fileName} created successfully!` });
                }
                const fileUpdateBody = {
                    "file": {
                        "name": fileName,
                        "content": Buffer.from(fileContent).toString('base64')
                    }
                }
                console.log({ fileUpdateBody })
                progress.report({ message: `Updating file ${fileName}` });
                const fileUpdateResponse = await axios.put(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, fileUpdateBody, {
                    headers: {
                        'Authorization': `Basic ${connectionDetails.authorization}`
                    }
                })
                console.log({ fileUpdateResponse })
                if (fileUpdateResponse.status === 200) {
                    progress.report({ message: `File ${fileName} updated successfully!`, increment: 100 });
                }
            }
        }
        catch (error) {
            progress.report({ message: `File ${fileName} does not exist in ${dpFolder}` });
            const fileBody = {
                "file": {
                    "name": fileName,
                    "content": Buffer.from(fileContent).toString('base64')
                }
            }
            progress.report({ message: `Uploading file ${fileName}` });
            const response = await axios.post(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}`, fileBody, {
                headers: {
                    'Authorization': `Basic ${connectionDetails.authorization}`
                }
            });
            if (/^2.*/.test(response.status)) {
                progress.report({ message: `File ${fileName} uploaded successfully!`, increment: 100 });
            } else {
                progress.report({ message: `Failed to upload file ${fileName}` });
            }
        }
    });
}

async function checkDataPowerConnection(connectionDetails) {
    if (!connectionDetails) {
        return false;
    }
    try {
        console.log(`${connectionDetails.socket}/mgmt/config/default/Domain`)
        console.log(`Basic ${connectionDetails.authorization}`)
        const connectionResponse = await axios.get(`${connectionDetails.socket}/mgmt/config/default/Domain`, {
            headers: {
                'Authorization': `Basic ${connectionDetails.authorization}`
            }
        });
        if (connectionResponse.status === 200) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.log(error);
        return false;
    }
}

async function getDataPowerDomains(connectionDetails) {
    if (!connectionDetails) {
        return undefined;
    }
    try {
        const domainsResponse = await axios.get(`${connectionDetails.socket}/mgmt/domains/config/`);
        if (domainsResponse.status === 200) {
            let domains = [];
            if (Array.isArray(domainsResponse.data.domain)) {
                domains = domainsResponse.data.domain.map(domain => domain.name);
            } else {
                domains = [domainsResponse.data.domain.name];
            };
            return domains;
        } else {
            return undefined;
        }
    } catch (error) {
        console.log(error);
        return undefined;
    }
}


async function getDataPowerFileManagementStatus(domain, connectionDetails, dpFolder) {
    console.log({ domain, connectionDetails })
    if (!connectionDetails || !domain) {
        return undefined;
    }
    try {
        const fileManagmentResponse = await axios.get(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}`, {
            headers: {
                'Authorization': `Basic ${connectionDetails.authorization}`
            }
        });
        if (fileManagmentResponse.status === 200) {
            if (fileManagmentResponse.data.filestore.location) {
                let dpPath = await vscode.window.showQuickPick(fileManagmentResponse.data.filestore.location.map((folder) => folder.name), { placeHolder: "Select a folder" });
                dpPath = dpPath.slice(0, -1)
                const subfolders = await searchSubfoldersAndChoose(domain, connectionDetails, dpPath);
                console.log({ subfolders })
                return subfolders;
            } else if (fileManagmentResponse.data.filestore.location)
                return undefined
        } else {
            return undefined;
        }
    } catch (error) {
        console.log(error);
        return undefined;

    }
}


async function searchSubfoldersAndChoose(domain, connectionDetails, dpFolder) {
    let currentFolder = dpFolder;

    while (true) {
        try {
            console.log(`${connectionDetails.socket}/mgmt/filestore/${domain}/${currentFolder}`)
            const subfoldersResponse = await axios.get(`${connectionDetails.socket}/mgmt/filestore/${domain}/${currentFolder}`, {
                headers: {
                    'Authorization': `Basic ${connectionDetails.authorization}`
                }
            });

            if (subfoldersResponse.status === 200 && subfoldersResponse.data.filestore.location) {
                console.log({ subfoldersResponse })
                let directory = subfoldersResponse.data.filestore.location.directory;
                if(!directory) {
                    return currentFolder;
                }
                console.log({ directory })
                if (!Array.isArray(directory)) {
                    directory = [directory];
                }

                const subfolderNames = directory.map((folder) => folder.name);

                const dpPath = await vscode.window.showQuickPick([...subfolderNames, 'Exit'], {
                    placeHolder: `Select a folder in ${currentFolder} or choose 'Exit' to stop`
                });

                if (dpPath === 'Exit') {
                    return currentFolder; // Return the final path when 'Exit' is selected
                } else {
                    // Ensure that the selected path is correctly formatted before appending
                    let cleanedPath = dpPath.replace(/^[^\/]*\//, ''); // Remove any prefix before the first '/'
                    cleanedPath = cleanedPath.replace(/\/$/, ''); // Remove trailing '/'

                    // Construct the new path
                    currentFolder = `${currentFolder}/${cleanedPath}`; // Append the cleaned path
                }
            } else {
                vscode.window.showInformationMessage(`No subfolders found in ${currentFolder}`);
                return currentFolder; // Return the current path if there are no subfolders
            }
        } catch (error) {
            console.log(error);
            
            return currentFolder.split('/').slice(0, -1).join('/'); // Return the parent folder if there is an error
        }
    }
}




module.exports = {
    uploadFileToDataPower,
    checkDataPowerConnection,
    getDataPowerDomains,
    getDataPowerFileManagementStatus
}