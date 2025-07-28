import {
  BreakpointObserver,
  Breakpoints,
  LayoutModule,
} from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, combineLatest } from 'rxjs';
import { ThemeConfig, ThemeService } from 'sailpoint-components';
import { ElectronService } from './core/services';
import { ConnectionService, Connection, SessionStatus, EnvironmentInfo } from './services/connection.service';
import {
  ComponentInfo,
  ComponentSelectorService,
} from './services/component-selector.service';
import { MatSidenav } from '@angular/material/sidenav';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    LayoutModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
})

export class AppComponent implements OnDestroy, OnInit {
  @ViewChild('logoImage') logoImageRef!: ElementRef<HTMLImageElement>;
  @ViewChild('sidenav') sidenav!: MatSidenav;

  // Inject services using Angular 20 inject() function
  private electronService = inject(ElectronService);
  private translate = inject(TranslateService);
  private connectionService = inject(ConnectionService);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private componentSelectorService = inject(ComponentSelectorService);

  // Use Angular 20 signals for reactive state - fully mutable
  isSmallScreen = signal<boolean>(false);
  sidenavOpened = signal<boolean>(true);
  isConnected = signal<boolean>(true);
  isDarkTheme = signal<boolean>(false);
  connectionName = signal<string>('');
  sessionStatus = signal<SessionStatus | undefined>(undefined);
  currentEnvironment = signal<EnvironmentInfo | undefined>(undefined);
  sessionStatusDisplay = signal<string>('Checking...');
  enabledComponents = signal<ComponentInfo[]>([]);
  logoPath = signal<string>('');

  // Computed values
  readonly isSessionValid = computed(() => this.connectionService.isSessionValid);
  readonly sessionExpiryTime = computed(() => this.connectionService.sessionExpiryTime);
  readonly timeUntilExpiry = computed(() => {
    const expiryDate = this.connectionService.sessionExpiryDate;
    if (!expiryDate) {
      return 0;
    }
    const now = new Date();
    return Math.max(0, expiryDate.getTime() - now.getTime());
  });

  readonly isRefreshing = computed(() => this.connectionService.isSessionRefreshing);

  private subscriptions = new Subscription();
  private timerInterval: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor() {
    // Subscribe to breakpoint changes
    this.subscriptions.add(
      this.breakpointObserver.observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall]).subscribe((result) => {
        this.isSmallScreen.set(result.matches);
        this.sidenavOpened.set(!result.matches);
      })
    );



    // Use effect to react to connection changes
    effect(() => {
      const connection = this.connectionService.connection();
      this.isConnected.set(connection.connected);
      this.connectionName.set(connection.name || '');
    });

    // Use effect to react to current environment changes
    effect(() => {
      const environment = this.connectionService.currentEnvironment();
      this.currentEnvironment.set(environment);
      if (environment && this.electronService.isElectron && environment.name && typeof environment.name === 'string') {
        void this.loadLogo(environment.name);
      } else {
        this.useFallbackLogo();
      }
    });

    // Use effect to react to theme changes
    effect(() => {
      const isDark = this.themeService.isDark();
      this.isDarkTheme.set(Boolean(isDark));
    });

    // Use effect to react to enabled components changes
    effect(() => {
      const components = this.componentSelectorService.enabledComponents();
      this.enabledComponents.set(components);
    });
  }

  ngOnInit(): void {
    // Set up expiry timer
    this.setupExpiryTimer();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearExpiryTimer();
  }

  isComponentEnabled(componentName: string): boolean {
    return this.enabledComponents().some(comp => comp.name === componentName);
  }

  private setupExpiryTimer(): void {
    this.clearExpiryTimer();
    this.timerInterval = setInterval(() => {
      const timeUntilExpiry = this.timeUntilExpiry();
      if (timeUntilExpiry <= 0) {
        this.sessionStatusDisplay.set('Expired');
      } else {
        this.sessionStatusDisplay.set(this.connectionService.sessionExpiryTime || 'Expired');
      }
    }, 1000);
  }

  private clearExpiryTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  async toggleTheme(): Promise<void> {
    const currentMode = this.themeService.getCurrentMode();
    const newMode = currentMode === 'light' ? 'dark' : 'light';
    const config = await this.themeService.getDefaultTheme(newMode);
    void this.themeService.saveTheme(config, newMode);
  }

  useFallbackLogo() {
    this.logoPath.set('assets/images/sailpoint-logo.png');
  }

  toggleSidenav(): void {
    this.sidenavOpened.set(!this.sidenavOpened());
  }

  onNavItemClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const navItem = target.closest('.nav-item');

    if (navItem) {
      const componentName = navItem.getAttribute('data-component');
      if (componentName) {
        void this.router.navigate(['/component', componentName]);
      }
    }
  }

  async disconnectFromISC() {
    await window.electronAPI.disconnectFromISC();
    this.connectionService.connection.set({ connected: false });
  }

  async manualRefreshSession() {
    await this.connectionService.manualRefreshSession();
  }

  private async loadLogo(environmentName: string): Promise<void> {
    try {
      const logoDataUrl = await window.electronAPI.getLogoDataUrl(environmentName);
      if (logoDataUrl && typeof logoDataUrl === 'string') {
        this.logoPath.set(logoDataUrl);
      } else {
        this.useFallbackLogo();
      }
    } catch (error) {
      console.error('Error loading logo:', error);
      this.useFallbackLogo();
    }
  }
}
