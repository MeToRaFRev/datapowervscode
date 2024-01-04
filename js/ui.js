const vscode = require('vscode');
async function promptForDataPowerCredentials() {
    try {
        const socket = await vscode.window.showInputBox({ prompt: "DataPower Full Socket:" });
        const username = await vscode.window.showInputBox({ prompt: "Username:" });
        const password = await vscode.window.showInputBox({ prompt: "Password:", password: true });

        if (!socket || !username || !password) {
            vscode.window.showWarningMessage('DataPower credentials are required.');
            console.warn("Incomplete DataPower credentials.");
            return null;
        }

        let authorization = Buffer.from(`${username}:${password}`).toString('base64');
        const connectionDetails = { socket, authorization };
        return connectionDetails;
    } catch (error) {
        vscode.window.showErrorMessage('Failed to prompt for DataPower credentials.');
        console.error("Credential Prompt Error:", error);
        return null;
    }
}

async function promptForDataPowerDomainSelection(domains) {
    try {
        const domain = await vscode.window.showQuickPick(domains, { placeHolder: "Select a domain" });

        if (!domain) {
            vscode.window.showWarningMessage('Domain selection is required.');
            console.warn("Domain selection was cancelled or no domain was selected.");
            return null;
        }

        return domain;
    } catch (error) {
        vscode.window.showErrorMessage('Failed to prompt for domain selection.');
        console.error("Domain Selection Prompt Error:", error);
        return null;
    }
}



module.exports = {
    promptForDataPowerCredentials,
    promptForDataPowerDomainSelection,
};