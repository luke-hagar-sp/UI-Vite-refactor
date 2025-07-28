import { Component, OnInit, ChangeDetectorRef, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectionService } from '../services/connection.service';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { TenantDataCardComponent } from './dashboard-cards/tenant-data/tenant-data-card.component';
import { SourcesComponent } from './dashboard-cards/sources/sources.component';
import { IdentitiesComponent } from './dashboard-cards/identities/identities.component';
import { IdentityProfilesComponent } from './dashboard-cards/identity-profiles/identity-profiles.component';
import { ShortcutsComponent } from './dashboard-cards/shortcuts/shortcuts.component';

type AuthMethods = "oauth" | "pat";
type OAuthValidationStatus = 'unknown' | 'valid' | 'invalid' | 'testing';

type Tenant = {
  active: boolean;
  apiUrl: string;
  tenantUrl: string;
  clientId?: string;
  clientSecret?: string;
  name: string;
  authType: AuthMethods;
  tenantName: string;
}

type EnvironmentConfig = {
  environmentName: string;
  tempTenantName?: string;
  tenantUrl: string;
  baseUrl: string;
  authType: AuthMethods;
  clientId?: string;
  clientSecret?: string;
}

type ComponentState = {
  isConnected: boolean;
  loading: boolean;
  name: string;
  tenants: Tenant[];
  selectedTenant: string;
  actualTenant?: Tenant;
  globalAuthMethod: AuthMethods;
  showEnvironmentDetails: boolean;
  oauthValidationStatus: OAuthValidationStatus;
  config: EnvironmentConfig;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    TenantDataCardComponent,
    SourcesComponent,
    IdentitiesComponent,
    IdentityProfilesComponent,
    ShortcutsComponent,
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatRadioModule,
    MatSnackBarModule,
    FormsModule,
    SharedModule
  ]
})
export class HomeComponent implements OnInit {

  // Inject services using Angular 20 inject() function
  private router = inject(Router);
  private connectionService = inject(ConnectionService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // State management
  state: ComponentState = {
    isConnected: false,
    loading: false,
    name: '',
    tenants: [],
    selectedTenant: 'new',
    actualTenant: undefined,
    globalAuthMethod: 'pat',
    showEnvironmentDetails: false,
    oauthValidationStatus: 'unknown',
    config: {
      environmentName: '',
      tenantUrl: '',
      baseUrl: '',
      authType: 'pat'
    }
  }

  constructor() {
    effect(() => {
      const connection = this.connectionService.connection();
      this.state.isConnected = connection.connected;
      this.state.name = connection.name || '';
    })
  }

  ngOnInit(): void {
    void this.initializeComponent();
  }

  // ===== INITIALIZATION =====
  private async initializeComponent(): Promise<void> {
    await Promise.all([
      this.loadTenants(),
      this.initializeGlobalAuthMethod()
    ]);
  }

  async initializeGlobalAuthMethod(): Promise<void> {
    try {
      const authMethod = await window.electronAPI.getGlobalAuthType();
      this.state.globalAuthMethod = authMethod as AuthMethods;
    } catch (error) {
      console.error('Error loading global auth method:', error);
      this.state.globalAuthMethod = 'pat';
    }
  }

  // Tenant Methods:
  async loadTenants(): Promise<void> {
    try {
      const tenants = await window.electronAPI.getTenants();
      this.state.tenants = tenants;

      const activeTenant = tenants.find(tenant => tenant.active === true);
      if (activeTenant) {
        this.state.selectedTenant = activeTenant.name;
        this.state.actualTenant = activeTenant;

        this.connectionService.currentEnvironment.set({
          name: activeTenant.name,
          apiUrl: activeTenant.apiUrl,
          baseUrl: activeTenant.tenantUrl,
          authType: activeTenant.authType,
          clientId: activeTenant.clientId || undefined,
          clientSecret: activeTenant.clientSecret || undefined
        });

        await this.refreshCurrentTenantAuthType();
        this.loadEnvironmentForEditing(activeTenant);
      } else {
        this.state.selectedTenant = 'new';
        await this.resetConfig();
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
      this.showSnackbar('Failed to load environments');
    }
  }

  async updateTenant(): Promise<void> {
    if (this.state.selectedTenant === 'new') {
      this.state.actualTenant = undefined;
      await this.resetConfig();
      return;
    }

    const actualTenant = this.state.tenants.find(tenant => tenant.name === this.state.selectedTenant);
    this.state.actualTenant = actualTenant;
    console.log(`Selected tenant:`, actualTenant);

    if (actualTenant) {
      await this.setActiveEnvironment(actualTenant.name);
      await this.refreshCurrentTenantAuthType();
      this.loadEnvironmentForEditing(actualTenant);
    }
  }

  async resetConfig(): Promise<void> {
    const currentAuthType = await window.electronAPI.getGlobalAuthType();

    const config: EnvironmentConfig = {
      environmentName: '',
      tenantUrl: '',
      baseUrl: '',
      authType: currentAuthType as AuthMethods
    };

    this.state.config = config;
    this.state.oauthValidationStatus = 'unknown';
  }

  async refreshCurrentTenantAuthType(): Promise<void> {
    try {
      const currentAuthType = await window.electronAPI.getGlobalAuthType();

      if (this.state.actualTenant) {
        this.state.actualTenant.authType = currentAuthType;
        console.log(`Updated auth type for ${this.state.actualTenant.name}: ${currentAuthType}`);
      }

      const tenantIndex = this.state.tenants.findIndex(t => t.name === this.state.selectedTenant);
      if (tenantIndex !== -1) {
        this.state.tenants[tenantIndex].authType = currentAuthType;
      }
    } catch (error) {
      console.error('Error refreshing auth type:', error);
    }
  }

  // Session Management
  async connectToISC(): Promise<void> {
    if (this.state.selectedTenant === 'new') {
      this.showSnackbar('Cannot connect to ISC: Please select an environment or create a new one first');
      return;
    }

    if (!this.state.actualTenant) {
      this.showSnackbar('Cannot connect to ISC: No environment selected');
      return;
    }

    this.state.loading = true;

    console.log('Connecting to:', this.state.actualTenant.name, 'at', this.state.actualTenant.apiUrl);
    console.log('Authentication type:', this.state.actualTenant.authType);

    try {
      console.log("Validating tokens");
      const tokenStatus = await window.electronAPI.validateTokens(this.state.actualTenant.name);

      console.log('tokenStatus', tokenStatus);

      if (!tokenStatus.isValid && tokenStatus.needsRefresh) {
        this.showSnackbar('Refreshing session...');
        await this.connectionService.manualRefreshSession();
        return;
      }

      try {
        const loginResult = await window.electronAPI.unifiedLogin(this.state.actualTenant.name);

        if (loginResult.success) {
          const tokenDetails = await window.electronAPI.getCurrentTokenDetails(this.state.actualTenant.name);
          if (tokenDetails.error || !tokenDetails.tokenDetails) {
            this.showSnackbar(`Failed to get token details. Please check your configuration and try again. \n\n${tokenDetails.error}`);
            return;
          }

          this.connectionService.sessionStatus.set({
            authType: this.state.actualTenant.authType,
            isValid: tokenStatus.isValid,
            lastChecked: new Date(),
            expiry: tokenDetails.tokenDetails.expiry,
          });
          this.connectionService.connection.set({ connected: true, name: this.state.actualTenant.name });
          this.state.isConnected = true;
          this.state.name = this.state.actualTenant.name;

          this.state.loading = false;
        } else {
          this.showSnackbar(`Failed to connect to the environment. Please check your configuration and try again. \n\n${loginResult.error}`);
        }
      } catch (error) {
        console.error('Unified login failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.showSnackbar(`Failed to connect to the environment. Please check your configuration and try again. \n\n${errorMessage}`);
      }
    } catch (error) {
      console.error('Error connecting to ISC:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.showSnackbar(`Failed to connect to the environment. Please check your configuration and try again. \n\n${errorMessage}`);
    } finally {
      this.state.loading = false;
    }
  }

  async disconnectFromISC(): Promise<void> {
    await window.electronAPI.disconnectFromISC();
    this.state.isConnected = false;
    this.connectionService.connection.set({ connected: false });
  }

  async testOAuthConnection(): Promise<{ error?: Error }> {
    if (!this.state.config.baseUrl) {
      this.state.oauthValidationStatus = 'invalid';
      return { error: new Error('Please provide API base URL') };
    }

    this.state.oauthValidationStatus = 'testing';

    try {
      const oauthInfoUrl = `${this.state.config.baseUrl}/oauth/info`;
      const response = await fetch(oauthInfoUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const oauthInfo = await response.json();
        this.state.oauthValidationStatus = 'valid';
        console.log('OAuth info response:', oauthInfo);
        return { error: undefined };
      } else {
        this.state.oauthValidationStatus = 'invalid';
        console.error('OAuth endpoint validation failed:', response.status, response.statusText);
        this.showSnackbar(`Failed to reach OAuth endpoint.\n\nPlease check your API base URL: ${this.state.config.baseUrl}`);
        return { error: new Error(`Failed to reach OAuth endpoint.\n\nPlease check your API base URL: ${this.state.config.baseUrl}`) };
      }
    } catch (error) {
      console.error('OAuth endpoint validation error:', error);
      this.state.oauthValidationStatus = 'invalid';
      this.showSnackbar(`Failed to reach OAuth endpoint.\n\nPlease check your API base URL: ${this.state.config.baseUrl}`);
      return { error: new Error(`Failed to reach OAuth endpoint.\n\nPlease check your API base URL: ${this.state.config.baseUrl}`) };
    }
  }

  // Environment Methods:

  validateConfig(): boolean {
    if (!this.state.config.environmentName.trim()) {
      this.showSnackbar('Environment name is required');
      return false;
    }

    if (this.state.selectedTenant === 'new' && !this.state.config.tempTenantName?.trim()) {
      this.showSnackbar('Tenant name is required to generate URLs');
      return false;
    }

    if (!this.state.config.tenantUrl.trim()) {
      this.showSnackbar('Tenant URL is required');
      return false;
    }

    if (!this.state.config.baseUrl.trim()) {
      this.showSnackbar('Base URL is required');
      return false;
    }

    if (this.state.config.authType === 'pat') {
      if (!this.state.config.clientId?.trim()) {
        this.showSnackbar('Client ID is required for PAT authentication');
        return false;
      }
      if (!this.state.config.clientSecret?.trim()) {
        this.showSnackbar('Client Secret is required for PAT authentication');
        return false;
      }
    }

    return true;
  }

  toggleEnvironmentDetails(): void {
    const newValue = !this.state.showEnvironmentDetails;
    this.state.showEnvironmentDetails = newValue;

    if (newValue) {
      if (this.state.actualTenant) {
        this.loadEnvironmentForEditing(this.state.actualTenant);
      } else if (this.state.selectedTenant === 'new') {
        void this.resetConfig();
      }
    }
  }

  loadEnvironmentForEditing(tenant: Tenant): void {
    const config: EnvironmentConfig = {
      environmentName: tenant.name,
      tenantUrl: tenant.tenantUrl,
      baseUrl: tenant.apiUrl,
      authType: tenant.authType,
      clientId: tenant.clientId || undefined,
      clientSecret: tenant.clientSecret || undefined
    };

    this.state.config = config;
    this.state.oauthValidationStatus = 'unknown';

    console.log(`Loaded environment config for: ${tenant.name}`, config);

    if (config.authType === 'oauth' && config.baseUrl) {
      void this.testOAuthConnection();
    }
  }

  async setActiveEnvironment(environmentName: string): Promise<void> {
    try {
      const result = await window.electronAPI.setActiveEnvironment(environmentName);
      if (result.success) {
        console.log(`Successfully set ${environmentName} as active environment`);
      } else {
        console.error('Failed to set active environment:', result.error);
        this.showSnackbar('Failed to set active environment');
      }
    } catch (error) {
      console.error('Error setting active environment:', error);
      this.showSnackbar('Failed to set active environment');
    }
  }

  async saveEnvironment(): Promise<void> {
    if (!this.validateConfig()) {
      return;
    }

    try {
      const clientId = this.state.config.clientId?.trim() || undefined;
      const clientSecret = this.state.config.clientSecret?.trim() || undefined;

      console.log('Saving environment with credentials:', {
        environmentName: this.state.config.environmentName,
        authType: this.state.config.authType,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      });

      const result = await window.electronAPI.updateEnvironment({
        environmentName: this.state.config.environmentName,
        tenantUrl: this.state.config.tenantUrl,
        baseUrl: this.state.config.baseUrl,
        authType: this.state.config.authType as 'oauth' | 'pat',
        clientId: clientId,
        clientSecret: clientSecret,
      });

      if (result.success) {
        this.showSnackbar(this.state.selectedTenant === 'new' ? 'Environment created successfully!' : 'Environment updated successfully!');
        await this.loadTenants();

        if (this.state.config.authType === 'oauth') {
          await this.testOAuthConnection();
        }

        await this.resetConfig();
        this.state.showEnvironmentDetails = false;
      } else {
        this.showSnackbar(String(result.error || 'Failed to save environment'));
      }
    } catch (error) {
      console.error('Error saving environment:', error);
      this.showSnackbar('Failed to save environment');
    }
  }

  async deleteEnvironment(): Promise<void> {
    if (!this.state.actualTenant || this.state.selectedTenant === 'new') {
      return;
    }

    try {
      const deleteResult = await window.electronAPI.deleteEnvironment(this.state.actualTenant.name);
      if (deleteResult.success) {
        // this.showSuccess('Environment deleted successfully!');
        await this.loadTenants();
        await this.resetConfig();
        this.state.selectedTenant = 'new';
        this.state.actualTenant = undefined;
        // this.showEnvironmentDetails$.next(false);
        // this.isConnected$.next(false);
        // this.connectionService.setConnectionState(false);
      } else {
        // this.showError(String(deleteResult.error || 'Failed to delete environment'));
      }
    } catch (error) {
      console.error('Error deleting environment:', error);
      // this.showError('Failed to delete environment');
    }
  }

  // Event Handlers:

  async onGlobalAuthMethodChange(): Promise<void> {
    try {
      await window.electronAPI.setGlobalAuthType(this.state.globalAuthMethod);
      console.log('Global auth method updated to:', this.state.globalAuthMethod);

      // Update the config to match the new global auth method
      this.state.config.authType = this.state.globalAuthMethod;

      // Update the actual tenant's auth type as well
      if (this.state.actualTenant) {
        this.state.actualTenant.authType = this.state.globalAuthMethod;
        // await this.refreshCurrentTenantAuthType();
      }
    } catch (error) {
      console.error('Error updating global auth method:', error);
    }
  }

  async onConfigAuthTypeChange(): Promise<void> {
    console.log('Config auth type changed to:', this.state.config.authType);

    // Update global auth method to match config auth type  
    this.state.globalAuthMethod = this.state.config.authType;

    // Update actual tenant auth type if it exists
    if (this.state.actualTenant) {
      this.state.actualTenant.authType = this.state.config.authType;
    }

    // Update the global auth type in the backend
    try {
      await window.electronAPI.setGlobalAuthType(this.state.config.authType);
    } catch (error) {
      console.error('Error updating global auth method:', error);
    }

    if (this.state.config.authType === 'oauth') {
      this.state.config.clientId = undefined;
      this.state.config.clientSecret = undefined;
    }

    if (this.state.config.authType === 'oauth' && this.state.config.baseUrl) {
      void this.testOAuthConnection();
    }
  }

  onTenantNameChange(): void {
    if (this.state.selectedTenant === 'new' && this.state.config.tempTenantName) {
      this.state.config.tenantUrl = `https://${this.state.config.tempTenantName}.identitynow.com`;
      this.state.config.baseUrl = `https://${this.state.config.tempTenantName}.api.identitynow.com`;

      if (this.state.config.authType === 'oauth') {
        void this.testOAuthConnection();
      }
    }
  }

  onBaseUrlChange(): void {
    this.state.oauthValidationStatus = 'unknown';

    if (this.state.config.authType === 'oauth' && this.state.config.baseUrl) {
      setTimeout(() => {
        void this.testOAuthConnection();
      }, 1000);
    }
  }

  // Utility Methods:

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000
    });
  }
}