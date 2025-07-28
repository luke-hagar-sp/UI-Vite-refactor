import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewEncapsulation, inject, signal, effect } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule, MatSelectionListChange } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { IdentityDocumentsV2025 } from 'sailpoint-api-client';
import { SailPointSDKService } from '../../../sailpoint-sdk.service';
import { IdentityService } from './identity-service';

@Component({
  selector: 'app-identity-search',
  templateUrl: './identity-search.component.html',
  styleUrls: ['./identity-search.component.scss'],
  imports: [
    // Material Modules
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatToolbarModule,
    CommonModule,
    ReactiveFormsModule
  ],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
})
export class IdentitySearchComponent implements OnInit, OnChanges, OnDestroy {
  // Inject services using Angular 20 inject() function
  private identityService = inject(IdentityService);

  @Input() profileId: string | null = null;
  @Input()
  sdkService!: SailPointSDKService;
  @Output() identitiesSelected = new EventEmitter<IdentityDocumentsV2025[]>();

  searchControl = new FormControl('');

  // Use Angular 20 signals for reactive state
  identities = signal<IdentityDocumentsV2025[]>([]);
  filteredIdentities = signal<IdentityDocumentsV2025[]>([]);
  selectedIdentities = signal<IdentityDocumentsV2025[]>([]);
  loading = signal<boolean>(false);
  error = signal<string>('');

  constructor() {
    // Use effect to react to identity service changes
    effect(() => {
      const identities = this.identityService.selectedIdentities();
      console.log('Selected Identities Effect:', identities);
      this.selectedIdentities.set(identities);
    });

    // Use effect to react to search control changes
    effect(() => {
      const searchValue = this.searchControl.value;
      if (searchValue !== null) {
        void this.searchIdentities(searchValue);
      }
    });
  }

  ngOnInit(): void {
    // Load identities when profile changes
    if (this.profileId) {
      void this.loadIdentities();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profileId'] && !changes['profileId'].firstChange) {
      this.clearAll(); // Clear everything before loading new identities
      void this.loadIdentities();
    }
  }

  clearAll(): void {
    this.identities.set([]);
    this.filteredIdentities.set([]);
    this.selectedIdentities.set([]);
    this.searchControl.setValue('');
    this.error.set('');
  }

  ngOnDestroy(): void {
    // No need to unsubscribe from signals as they are not RxJS subjects
  }

  async loadIdentities(): Promise<void> {
    if (!this.profileId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const response = await this.sdkService.listIdentities({
        limit: 1000,
        filters: `profileId eq "${this.profileId}"`,
      });

      const identities = response.data || [];
      this.identities.set(identities);
      this.filteredIdentities.set(identities);
    } catch (err) {
      console.error('Error loading identities:', err);
      this.error.set('Failed to load identities');
    } finally {
      this.loading.set(false);
    }
  }

  async searchIdentities(query: string): Promise<void> {
    if (!query.trim()) {
      this.filteredIdentities.set(this.identities());
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = this.identities().filter(identity => {
      const name = identity.name?.toLowerCase() || '';
      const alias = identity.alias?.toLowerCase() || '';
      const email = identity.emailAddress?.toLowerCase() || '';

      return name.includes(searchTerm) ||
        alias.includes(searchTerm) ||
        email.includes(searchTerm);
    });

    this.filteredIdentities.set(filtered);
  }

  onSelectionChange(event: MatSelectionListChange): void {
    const selected = event.source.selectedOptions.selected.map(option => option.value);
    this.selectedIdentities.set(selected);
    this.identitiesSelected.emit(selected);
  }

  isSelected(identity: IdentityDocumentsV2025): boolean {
    return this.selectedIdentities().some(selected => selected.id === identity.id);
  }

  getIdentityDisplay(identity: IdentityDocumentsV2025): string {
    return `${identity.name || 'Unknown'} (${identity.alias || 'No alias'})`;
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.filteredIdentities.set(this.identities());
  }
}
