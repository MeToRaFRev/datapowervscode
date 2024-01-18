# DPSync - DataPower Synchronization Extension for VS Code

## Description

DPSync is a Visual Studio Code extension designed for seamless synchronization between your local development environment and IBM DataPower Gateway. This extension monitors changes in local files and automatically uploads them to a specified DataPower instance, enhancing the development and testing workflow.

## Features

- **Real-Time Synchronization:** Automatically uploads changed files to DataPower.
- **Secure Connection:** Handles DataPower credentials securely.
- **Domain and File Management:** Allows domain selection and supports various file operations.

## Structure

- `extension.js`: Main extension file that orchestrates the activation, setup, and command registration.
- `datapower.js`: Handles DataPower-specific operations like checking connections and fetching domain information.
- `ui.js`: Manages user interface elements for credential input and domain selection.
- `fileWatcher.js`: Monitors file changes in the workspace and triggers synchronization actions.

## Installation

Download and install the extension from the Visual Studio Code Marketplace.

## Usage

1.  **Open a Workspace:** Open a folder in VS Code to synchronize with DataPower.
2.  **Configure Connection:** Enter DataPower connection details when prompted.
3.  **Select Domain:** Choose the desired DataPower domain for synchronization.
4.  **Automatic Synchronization:** The extension watches for file changes and syncs them to DataPower.

## Commands

- `datapowervscode.manualDatapowerConnection`: Opens a panel to manually input or update DataPower connection details.

## Configuration

Stores DataPower connection details in `_datapower-config.json` located in the workspace root.

## Troubleshooting

Check DataPower accessibility and credential accuracy. Refer to the VS Code console for error logs.
