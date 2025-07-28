import { Injectable, OnDestroy, signal, computed } from '@angular/core';

export interface Connection {
  connected: boolean;
  name?: string;
}

export interface SessionStatus {
  isValid: boolean;
  expiry?: Date;
  authType?: string;
  lastChecked: Date;
}

export interface EnvironmentInfo {
  name: string;
  apiUrl: string;
  baseUrl: string;
  authType: 'oauth' | 'pat';
  clientId?: string;
  clientSecret?: string;
}

@Injectable({
  providedIn: 'root'
})

export class ConnectionService implements OnDestroy {
  // Use Angular 20 signals for better reactivity - fully mutable
  connection = signal<Connection>({ connected: false });
  sessionStatus = signal<SessionStatus | undefined>(undefined);
  currentEnvironment = signal<EnvironmentInfo | undefined>(undefined);

  // Computed values using signals
  readonly isConnected = computed(() => this.connection().connected);
  readonly isSessionValid = computed(() => {
    const status = this.sessionStatus();
    return status?.isValid ?? false;
  });

  isSessionRefreshing = false;
  isDestroyed = false;

  constructor() {
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
  }

  async validateConnectionImmediately(environmentName: string): Promise<void> {
    try {
      const tokenStatus = await window.electronAPI.validateTokens(environmentName);

      console.log('tokenStatus', tokenStatus);

      console.log('expiry', tokenStatus.tokenDetails?.expiry.toLocaleString());
      console.log('expiry type', typeof tokenStatus.tokenDetails?.expiry);

      let authType: string | undefined = undefined;
      if ('authType' in tokenStatus && typeof (tokenStatus as any).authType === 'string') {
        authType = (tokenStatus as any).authType;
      }
      const sessionStatus: SessionStatus = {
        isValid: tokenStatus.isValid,
        expiry: tokenStatus.tokenDetails?.expiry,
        authType,
        lastChecked: new Date()
      };

      console.log('sessionStatus', sessionStatus);

      this.sessionStatus.set(sessionStatus);

      if (!tokenStatus.isValid) {
        console.log('Token is invalid, attempting to refresh...');
        await this.refreshSession();
      }
    } catch (error) {
      console.error('Error validating connection:', error);
      const errorStatus: SessionStatus = {
        isValid: false,
        lastChecked: new Date()
      };
      this.sessionStatus.set(errorStatus);
    }
  }

  async refreshSession(): Promise<void> {
    if (this.isSessionRefreshing) {
      console.log('Session refresh already in progress');
      return;
    }

    this.isSessionRefreshing = true;

    try {
      const environment = this.currentEnvironment();
      if (!environment) {
        throw new Error('No environment available for refresh');
      }

      console.log('Refreshing session for environment:', environment.name);

      const refreshResult = await window.electronAPI.refreshTokens(environment.name);
      console.log('Refresh token result:', refreshResult);

      if (!refreshResult.success) {
        console.log('Token refresh failed, attempting reconnection...');
        await this.handleSessionExpired();
        return;
      }

      // After refresh, re-validate tokens to update session status
      await this.validateConnectionImmediately(environment.name);
    } catch (error) {
      console.error('Error refreshing session:', error);
      await this.handleSessionExpired();
    } finally {
      this.isSessionRefreshing = false;
    }
  }

  async handleSessionExpired(): Promise<void> {
    this.connection.set({ connected: false });
    await this.reconnectSession();
  }

  async reconnectSession(): Promise<void> {
    const environment = this.currentEnvironment();
    if (!environment) {
      console.error('No environment available for reconnection');
      return;
    }

    try {
      console.log('Attempting to reconnect to environment:', environment.name);
      const loginResult = await window.electronAPI.unifiedLogin(environment.name);
      if (loginResult.success) {
        this.connection.set({ connected: true, name: environment.name });
        await this.validateConnectionImmediately(environment.name);
      } else {
        console.error('Reconnection failed:', loginResult.error);
        this.connection.set({ connected: false });
      }
    } catch (error) {
      console.error('Error during reconnection:', error);
      this.connection.set({ connected: false });
    }
  }

  // Public method for manual session refresh
  async manualRefreshSession(): Promise<void> {
    const environment = this.currentEnvironment();

    if (!environment) {
      console.error('No environment available for manual refresh');
      return;
    }

    try {
      console.log('Manual session refresh for environment:', environment.name);
      const loginResult = await window.electronAPI.unifiedLogin(environment.name);
      if (loginResult.success) {
        this.connection.set({ connected: true, name: environment.name });
        await this.validateConnectionImmediately(environment.name);
      } else {
        console.error('Manual refresh failed:', loginResult.error);
        this.connection.set({ connected: false });
      }
    } catch (error) {
      console.error('Error during manual refresh:', error);
      this.connection.set({ connected: false });
    }
  }

  // Utility methods for components
  get sessionExpiryDate(): Date | undefined {
    const status = this.sessionStatus();
    return status?.expiry;
  }

  get sessionExpiryTime(): string | undefined {
    const status = this.sessionStatus();
    if (!status?.expiry) {
      return undefined;
    }

    const now = new Date();
    const timeDiff = status.expiry.getTime() - now.getTime();

    if (timeDiff <= 0) {
      return 'Expired';
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
