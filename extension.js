// Importing necessary modules
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getDataPowerDomains, getDataPowerFileManagementStatus, checkDataPowerConnection } = require('./js/datapower.js');
const { startWatching } = require('./js/fileWatcher.js');
const { promptForDataPowerCredentials, promptForDataPowerDomainSelection } = require('./js/ui.js');

// Disabling TLS/SSL certificate validation (Be aware of the security implications)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
async function activate(context) {
	try {
		console.log('Your extension "datapowervscode" is now active!');
		let folders;
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			// Prompt user to select a folder
			const userChoice = await vscode.window.showInformationMessage(
				'Do you want to select a folder to initialize DPSync?',
				'Select Folder', 'Cancel'
			);
			if (userChoice === 'Select Folder') {
				folders = await determineFolderPath();
				if (!folders) {
					vscode.window.showErrorMessage('Folder selection is required to start the extension.');
					return;
				}
			} else {
				return; // User cancelled the operation
			}
		} else {
			// Use the first workspace folder
			let folderUri = vscode.workspace.workspaceFolders[0].uri;
			folders = { folderPath: folderUri.fsPath, folderUri };
		}
		// Initialize status bar
		statusBar.text = `DPSync: Initializing...`;
		statusBar.show();

		// Determine folder path for synchronization
		if (folders.status === 'opening') {
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Opening Folder",
				cancellable: false
			}, async (progress) => {
				progress.report({ message: "Opening Folder..." });

				// Create a promise that resolves when the workspace folders change
				const folderLoaded = new Promise((resolve) => {
					const disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
						disposable.dispose(); // Clean up the listener
						resolve();
					});
				});

				// Wait for the folder to be loaded
				await folderLoaded;

				// Update progress to complete
				progress.report({ increment: 100 });
			});
			return;
		}
		if (!folders || !folders.folderPath || !folders.folderUri) {
			vscode.window.showErrorMessage('Folder selection is required to start the extension.');
			statusBar.text = `DPSync: Not Connected`;
			return;
		}

		// Obtain connection details, either from saved config or user input
		let connectionDetails = await getDataPowerConfig() || await promptForDataPowerCredentials();
		if (!connectionDetails) {
			vscode.window.showErrorMessage('DataPower connection details are required.');
			statusBar.text = `DPSync: Not Connected`;
			return;
		}
		console.log(connectionDetails);
		statusBar.text = `DPSync: Connecting to ${connectionDetails.socket}`;
		// Start the extension's main functionality
		const result = await startExtension(connectionDetails, folders.folderPath, statusBar);
		if (!result) {
			vscode.window.showErrorMessage(`Failed to start extension. result: ${result}`);
			statusBar.text = `DPSync: Not Connected`;
			return;
		}
		const folderName = folders.folderPath.split('\\').pop();
		statusBar.text = `DPSync: ${folderName} <-> ${result.dpFolder}`;
		// Handle command registration
		handleActivationCommands(context, statusBar);
	} catch (error) {
		vscode.window.showErrorMessage(`Activation Error: ${error.message}`);
		console.error("Activation Error:", error);
	}
	context.subscriptions.push(statusBar);
}

// Determine the folder path based on the workspace configuration
async function determineFolderPath() {
	const folderUri = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		openLabel: 'Select Folder to sync with local filestore',
		defaultUri: vscode.Uri.file(path.join(__dirname, '..'))
	});

	if (folderUri && folderUri[0]) {
		vscode.workspace.updateWorkspaceFolders(0, 0, { uri: folderUri[0] });
		return { folderPath: folderUri[0].fsPath, folderUri: folderUri[0], status: 'opening' };
	}

	return null; // No folder was selected
}

// Reads and parses the DataPower configuration file
async function getDataPowerConfig() {
	const dataPowerConfigFilePath = getDataPowerConfigFilePath();
	if (fs.existsSync(dataPowerConfigFilePath)) {
		try {
			const configData = fs.readFileSync(dataPowerConfigFilePath, 'utf8');
			return JSON.parse(configData);
		} catch (error) {
			vscode.window.showErrorMessage('Failed to read or parse the DataPower config file.');
			console.error("Config File Error:", error);
		}
	} else {
		vscode.window.showInformationMessage(`No config file found, please enter DataPower credentials`);
	}
	return null;
}

// Returns the DataPower config file path
function getDataPowerConfigFilePath() {
	if (vscode.workspace.workspaceFolders) {
		return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '_datapower-config.json');
	}
	return '';
}

// The core function to start the extension's main functionality
// The core function to start the extension's main functionality
async function startExtension(connectionDetails, folderPath, statusBar) {
	let extensionResult = null;
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Initializing DPSync",
			cancellable: false
		}, async (progress) => {
			progress.report({ message: "Connecting to DataPower..." });

			const connection = await checkDataPowerConnection(connectionDetails);
			if (!connection) {
				throw new Error(`Failed to connect to DataPower! Connection ${connectionDetails.socket} is not available.`);
			}

			progress.report({ message: "Saving configuration..." });
			fs.writeFileSync(getDataPowerConfigFilePath(), JSON.stringify(connectionDetails, null, 4));

			progress.report({ message: "Fetching domains..." });
			const domains = await getDataPowerDomains(connectionDetails);
			if (!domains) {
				throw new Error('Failed to fetch domains!');
			}

			progress.report({ message: "Selecting domain..." });
			const selectedDomain = await promptForDataPowerDomainSelection(domains);
			if (!selectedDomain) {
				throw new Error('No domain selected!');
			}

			progress.report({ message: "Fetching file management status..." });
			const fileManagement = await getDataPowerFileManagementStatus(selectedDomain, connectionDetails);
			if (!fileManagement) {
				throw new Error('Failed to fetch file management status!');
			}

			progress.report({ message: "Setting up file watcher..." });
			startWatching(folderPath, selectedDomain, connectionDetails);

			vscode.window.showInformationMessage(`Now watching ${folderPath} for changes.`);
			extensionResult = { dpFolder: fileManagement, localFolder: folderPath };
		});
	} catch (error) {
		vscode.window.showErrorMessage(`Error: ${error.message}`);
		statusBar.text = `DPSync: ${error.message}`;
		console.error("Start Function Error:", error);
		return null;
	}
	return extensionResult;
}


// Handles command registration and status bar updates
function handleActivationCommands(context) {

	let disposable = vscode.commands.registerCommand('datapowervscode.manualDatapowerConnection', async () => {
		// Logic for manual DataPower connection
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {
	if (statusBar) {
		statusBar.dispose(); // Dispose of the status bar item
	}
	// Clean up resources, listeners, etc.
}

module.exports = {
	activate,
	deactivate
};