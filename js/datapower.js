const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
async function uploadFileToDataPower(filePath, domain, connectionDetails, dpFolder) {
    const fileName = path.basename(filePath);
    let fileContent;
    console.log(`Uploading file ${fileName} to DataPower`);
    try {
        fileContent = fs.readFileSync(filePath);
    } catch (error) {
        const deletedFileResponse = await axios.delete(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, {
            headers: {
                'Authorization': `Basic ${connectionDetails.authorization}`
            }
        });
        if (/^2.*/.test(deletedFileResponse.status)) {
            vscode.window.showInformationMessage(`File ${fileName} deleted successfully!`);
        } else {
            vscode.window.showErrorMessage(`Failed to delete file ${fileName}`);
        }
        return;
    }
    try {
        console.log(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`)
        const fileExistsResponse = await axios.get(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, {
            headers: {
                'Authorization': `Basic ${connectionDetails.authorization}`
            }
        });
        console.log({ fileExistsResponse })
        if (fileExistsResponse.status === 200) {
            // if file exists check if there is a folder in the workspace with the date of today
            // if not create one and put the current file in it
            if (!fs.existsSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`))) {
                fs.mkdirSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`));
                vscode.window.showInformationMessage(`Backup folder for date ${new Date().toISOString().slice(0, 10)} created successfully!`);
            }
            if (!fs.existsSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`, `_${fileName}`))) {
                //this is base64 to string
                const fileContent = Buffer.from(fileExistsResponse.data.file, 'base64').toString('utf-8');
                fs.writeFileSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, `_${new Date().toISOString().slice(0, 10)}`, `_${fileName}`), fileContent);
                vscode.window.showInformationMessage(`Backup of file ${fileName} created successfully!`);
            }
            const fileUpdateBody = {
                "file": {
                    "name": fileName,
                    "content": Buffer.from(fileContent).toString('base64')
                }
            }
            console.log({ fileUpdateBody })
            const fileUpdateResponse = await axios.put(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}/${fileName}`, fileUpdateBody, {
                headers: {
                    'Authorization': `Basic ${connectionDetails.authorization}`
                }
            }).catch(error => {
                console.log({ error });
            })
            console.log({ fileUpdateResponse })
            if (fileUpdateResponse.status === 200) {
                vscode.window.showInformationMessage(`File ${fileName} updated successfully!`);
            }
        }
    }
    catch (error) {
        const fileBody = {
            "file": {
                "name": fileName,
                "content": Buffer.from(fileContent).toString('base64')
            }
        }
        const response = await axios.post(`${connectionDetails.socket}/mgmt/filestore/${domain}/${dpFolder}`, fileBody, {
            headers: {
                'Authorization': `Basic ${connectionDetails.authorization}`
            }
        });
        if (/^2.*/.test(response.status)) {
            vscode.window.showInformationMessage(`File ${fileName} uploaded successfully!`);
        } else {
            vscode.window.showErrorMessage(`Failed to upload file ${fileName}`);
        }
    }
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


async function getDataPowerFileManagementStatus(domain, connectionDetails,dpFolder) {
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
                const dpPath = await vscode.window.showQuickPick(fileManagmentResponse.data.filestore.location.map((folder)=>folder.name), { placeHolder: "Select a folder" });
                return `${dpPath.slice(0,-1)}`;
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

module.exports = {
    uploadFileToDataPower,
    checkDataPowerConnection,
    getDataPowerDomains,
    getDataPowerFileManagementStatus
}