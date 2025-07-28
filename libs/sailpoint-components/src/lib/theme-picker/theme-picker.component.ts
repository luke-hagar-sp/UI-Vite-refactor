/// <reference path="../../../../../src/global.d.ts" />

// Angular core and common modules
import { CommonModule } from '@angular/common';
import {
  Component,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  OnInit,
  inject,
  signal,
  effect,
} from '@angular/core';

// Angular Material UI modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';

// Theme management service and config interface
import { ThemeService, ThemeConfig } from '../theme/theme.service';

// Required for deep cloning
declare function structuredClone<T>(value: T): T;

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatSelectModule,
  ],
  templateUrl: './theme-picker.component.html',
  styleUrl: './theme-picker.component.scss',
})
export class ThemePickerComponent implements OnInit {
  // Inject services using Angular 20 inject() function
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  title = 'Theme Picker';
  selectedLogoFileName = signal<string>('');

  // Reference to the logo <img> in the template
  @ViewChild('logoImage') logoImageRef!: ElementRef<HTMLImageElement>;

  // now type the fields so that `key` is ONLY one of the keys of ThemeConfig:
  readonly colorFields: Array<{ label: string; key: keyof ThemeConfig }> = [
    { label: 'Primary', key: 'primary' },
    { label: 'Secondary', key: 'secondary' },
    { label: 'Primary Text', key: 'primaryText' },
    { label: 'Secondary Text', key: 'secondaryText' },
    { label: 'Hover Text', key: 'hoverText' },
    { label: 'Background', key: 'background' },
  ];

  // Track current theme mode using signals
  mode = signal<'light' | 'dark'>(this.themeService.getCurrentMode());

  // Spinner visibility
  loading = signal<boolean>(false);

  // Factory for empty theme object
  emptyTheme(): ThemeConfig {
    return {
      primary: '',
      secondary: '',
      primaryText: '',
      secondaryText: '',
      hoverText: '',
      background: '',
      logoLight: '',
      logoDark: '',
    };
  }

  // Store theme colors for each mode using signals
  lightColors = signal<ThemeConfig>({ ...this.emptyTheme() });
  darkColors = signal<ThemeConfig>({ ...this.emptyTheme() });

  // Getter for current mode's color config
  get colors(): ThemeConfig {
    return this.mode() === 'light' ? this.lightColors() : this.darkColors();
  }

  set colors(value: ThemeConfig) {
    if (this.mode() === 'light') {
      this.lightColors.set(value);
    } else {
      this.darkColors.set(value);
    }
  }

  private ignoreNextDarkChange = signal<boolean>(false); // reserved for preventing recursive theme toggling (not used here)

  ngOnInit(): void {
    // Load initial theme
    void this.loadThemeForMode();
  }

  async onModeChange() {
    this.mode.set(this.mode() === 'light' ? 'dark' : 'light');
    void this.loadThemeForMode();
  }

  selectedLogoFile?: File;
  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedLogoFile = target.files[0];
      this.selectedLogoFileName.set(this.selectedLogoFile.name);

      // Preview the selected logo
      if (this.logoImageRef) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (this.logoImageRef) {
            this.logoImageRef.nativeElement.src = e.target?.result as string;
          }
        };
        reader.readAsDataURL(this.selectedLogoFile);
      }
    }
  }

  async loadThemeForMode(): Promise<void> {
    try {
      const theme = await this.themeService.loadTheme(this.mode(), false);
      this.colors = structuredClone(theme);
    } catch (error) {
      console.error('Error loading theme for mode:', error);
    }
  }

  constructor() {
    // Use effect to react to theme changes
    effect(() => {
      const currentMode = this.themeService.getCurrentMode();
      if (currentMode !== this.mode()) {
        this.mode.set(currentMode);
        void this.loadThemeForMode();
      }
    });
  }

  private readFileAsBuffer(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        resolve(new Uint8Array(arrayBuffer));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async onResetLogo() {
    // Check if we're in Electron mode
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    if (!isElectron) {
      this.snackBar.open('Logo reset is only available in Electron mode', 'Close', {
        duration: 3000,
      });
      return;
    }

    try {
      this.loading.set(true);
      const logoFileName = this.mode() === 'light' ? 'logo.png' : 'logo-dark.png';
      // Note: deleteLogo method doesn't exist, so we'll just clear the filename
      this.selectedLogoFileName.set('');
      this.snackBar.open('Logo reset successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error resetting logo:', error);
      this.snackBar.open('Error resetting logo', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async apply() {
    try {
      this.loading.set(true);

      // Save logo if selected
      const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
      if (this.selectedLogoFile && isElectron) {
        const buffer = await this.readFileAsBuffer(this.selectedLogoFile);
        const logoFileName = this.mode() === 'light' ? 'logo.png' : 'logo-dark.png';
        await window.electronAPI.writeLogo(logoFileName, buffer);
        await this.themeService.waitForFile(logoFileName);
      }

      // Save theme configuration
      await this.themeService.saveTheme(this.colors, this.mode());

      this.snackBar.open('Theme applied successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error applying theme:', error);
      this.snackBar.open('Error applying theme', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }
}
