import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-shortcuts',
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './shortcuts.component.html',
  styleUrl: './shortcuts.component.scss'
})
export class ShortcutsComponent {
  shortcuts = [
    {
      icon: 'people',
      label: 'Identity Management',
      url: '/identities'
    },
    {
      icon: 'security',
      label: 'Access Requests',
      url: '/access-requests'
    },
    {
      icon: 'assessment',
      label: 'Certifications',
      url: '/certifications'
    },
    {
      icon: 'analytics',
      label: 'Reports & Analytics',
      url: '/reports'
    },
    {
      icon: 'settings',
      label: 'System Configuration',
      url: '/config'
    },
    {
      icon: 'admin_panel_settings',
      label: 'Administration',
      url: '/admin'
    },
    {
      icon: 'integration_instructions',
      label: 'Integrations',
      url: '/integrations'
    },
    {
      icon: 'monitoring',
      label: 'Monitoring & Alerts',
      url: '/monitoring'
    }
  ];

  onShortcutClick(shortcut: any): void {
    window.open(shortcut.url, '_blank');
  }
} 