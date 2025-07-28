import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { mkdir, readFile, writeFile } from 'fs/promises';
import path, { join } from 'path'

import { harborPilotTransformChat } from './api.ts';
import { setupSailPointSDKHandlers } from './sailpoint-sdk/ipc-handlers.ts';
import { disconnectFromISC, getGlobalAuthType, refreshTokens, setGlobalAuthType, unifiedLogin, validateTokens, checkAccessTokenStatus, checkRefreshTokenStatus, getCurrentTokenDetails } from './authentication/auth.ts';
import { deleteEnvironment, getTenants, setActiveEnvironment, updateEnvironment, UpdateEnvironmentRequest } from './authentication/config.ts';
import { getStoredOAuthTokens } from './authentication/oauth.ts';
import { getStoredPATTokens, storeClientCredentials } from './authentication/pat.ts';
import contextMenu from 'electron-context-menu';

contextMenu({
  showSearchWithGoogle: true,
  showCopyImage: true,
  showCopyLink: true,
});

// @ts-expect-error - icon is a valid asset
import icon from '../resources/icon.png?asset'

console.log(`Now starting main process in ${is.dev ? 'development' : 'production'} mode`)

// Utility functions
function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');
  return configPath;
}

function ensureConfigDir(): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

function createWindow(): BrowserWindow {
  const size = screen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    x: 0,
    y: size.height - (size.height / 2),
    width: size.width / 2,
    height: size.height / 2,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    import('electron-debug').then(m => m.default())
    console.log('Loading remote URL', process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    console.log('Loading local HTML file')
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow;
}

try {

  //#region Main event handlers

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // In this file you can include the rest of your app"s specific main process
  // code. You can also put them in separate files and require them here.

  //#endregion

  //#region Custom IPC handlers

  ipcMain.handle('unified-login', async (event, environment: string) => {
    return unifiedLogin(environment);
  });

  ipcMain.handle('disconnect-from-isc', () => {
    return disconnectFromISC();
  });

  ipcMain.handle('check-access-token-status', (event, environment: string) => {
    return checkAccessTokenStatus(environment);
  });

  ipcMain.handle('check-refresh-token-status', (event, environment: string) => {
    return checkRefreshTokenStatus(environment);
  });

  ipcMain.handle('get-current-token-details', (event, environment: string) => {
    return getCurrentTokenDetails(environment);
  });



  ipcMain.handle('refresh-tokens', (event, environment: string) => {
    return refreshTokens(environment);
  });

  ipcMain.handle('get-stored-oauth-tokens', (event, environment: string) => {
    return getStoredOAuthTokens(environment);
  });

  ipcMain.handle('get-stored-pat-tokens', (event, environment: string) => {
    return getStoredPATTokens(environment);
  });

  ipcMain.handle('store-client-credentials', (event, environment: string, clientId: string, clientSecret: string) => {
    return storeClientCredentials(environment, clientId, clientSecret);
  });

  ipcMain.handle('validate-tokens', (event, environment: string) => {
    return validateTokens(environment);
  });


  ipcMain.handle('get-tenants', () => {
    return getTenants();
  });

  ipcMain.handle('update-environment', (event, config: UpdateEnvironmentRequest) => {
    return updateEnvironment(config);
  });

  ipcMain.handle(
    'delete-environment',
    (event, environment: string) => {
      return deleteEnvironment(environment);
    }
  );

  ipcMain.handle(
    'set-active-environment',
    (event, environment: string) => {
      return setActiveEnvironment(environment);
    }
  );

  ipcMain.handle('get-global-auth-type', () => {
    return getGlobalAuthType();
  });

  ipcMain.handle('set-global-auth-type', (event, authType: "oauth" | "pat") => {
    return setGlobalAuthType(authType);
  });


  ipcMain.handle('harbor-pilot-transform-chat', async (event, chat) => {
    return await harborPilotTransformChat(chat);
  });


  ipcMain.handle('read-config', () => {
    try {
      const configPath = getConfigPath();
      if (existsSync(configPath)) {
        const configData = readFileSync(configPath, 'utf-8');
        return JSON.parse(configData);
      } else {
        const defaultConfig = {
          components: {
            enabled: [],
          },
          version: '1.0.0',
        };

        ensureConfigDir();
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error reading config file:', error);
      throw new Error('Failed to read config file');
    }
  });

  ipcMain.handle('write-config', (event, config) => {
    try {
      const configPath = getConfigPath();
      ensureConfigDir();
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Error writing config file:', error);
      throw new Error('Failed to write config file');
    }
  });


  ipcMain.handle('write-logo', async (event, buffer, fileName) => {
    try {
      const logoDir = path.join(app.getPath('userData'), 'assets', 'icons');
      await mkdir(logoDir, { recursive: true });

      const dest = path.join(logoDir, fileName);
      await writeFile(dest, buffer);

      return { success: true };
    } catch (error) {
      console.error('Error writing logo file:', error);
      throw new Error('Failed to write logo file');
    }
  });

  ipcMain.handle('check-logo-exists', (event, fileName: string) => {
    const fullPath = path.join(
      app.getPath('userData'),
      'assets',
      'icons',
      fileName
    );
    return existsSync(fullPath);
  });

  ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData');
  });

  ipcMain.handle('get-logo-data-url', async (event, fileName) => {
    try {
      const userDataPath = app.getPath('userData');
      const logoPath = path.join(userDataPath, 'assets', 'icons', fileName);
      const buffer = await readFile(logoPath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(fileName).substring(1); // e.g., png
      return `data:image/${ext};base64,${base64}`;
    } catch (err) {
      console.error('Failed to get logo data URL:', err);
      return null;
    }
  });

  //#endregion

  // Populate SDK handlers
  setupSailPointSDKHandlers();

} catch (e) {
  console.error('Error during app initialization', e);
}