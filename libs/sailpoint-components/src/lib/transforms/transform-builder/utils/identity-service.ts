import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { IdentityDocumentsV2025, SearchV2025ApiSearchPostRequest } from 'sailpoint-api-client';
import { SailPointSDKService } from '../../../sailpoint-sdk.service';

@Injectable({
  providedIn: 'root'
})
export class IdentityService {

  // Inject services using Angular 20 inject() function
  private http = inject(HttpClient);

  // Use Angular 20 signals for reactive state
  private _selectedIdentities = signal<IdentityDocumentsV2025[]>([]);

  // Expose as readonly signal
  readonly selectedIdentities = this._selectedIdentities.asReadonly();

  constructor() {
    // Load selected identities from local storage if available
    this.loadSelectedIdentitiesFromStorage();
  }

  async getIdentitiesByProfile(
    profileId: string,
    sdkService: SailPointSDKService,
    searchQuery?: string
  ): Promise<IdentityDocumentsV2025[]> {

    let queryString = `identityProfile.id:${profileId}`;

    if (searchQuery?.trim()) {
      const escaped = searchQuery.replace(/"/g, '\\"'); // escape quotes if necessary
      queryString += ` AND (name:*${escaped}*)`;
    }

    const request: SearchV2025ApiSearchPostRequest = {
      searchV2025: {
        indices: ['identities'],
        query: {
          query: queryString
        },
        sort: ['name']
      },
      limit: 250
    };

    try {
      const response = await sdkService.searchPost?.(request);
      if (response && 'data' in response) {
        return response.data as IdentityDocumentsV2025[];
      }
      return [];
    } catch (err) {
      console.error('Search request failed:', err);
      return [];
    }
  }

  /**
   * Update the selected identities
   */
  updateSelectedIdentities(identities: IdentityDocumentsV2025[]): void {
    this._selectedIdentities.set(identities);
    this.saveSelectedIdentitiesToStorage(identities);
  }

  /**
   * Add a single identity to the selection
   */
  addSelectedIdentity(identity: IdentityDocumentsV2025): void {
    const current = this._selectedIdentities();
    if (!current.some(existing => existing.id === identity.id)) {
      const updated = [...current, identity];
      this._selectedIdentities.set(updated);
      this.saveSelectedIdentitiesToStorage(updated);
    }
  }

  /**
   * Remove a single identity from the selection
   */
  removeSelectedIdentity(identityId: string): void {
    const current = this._selectedIdentities();
    const updated = current.filter(identity => identity.id !== identityId);
    this._selectedIdentities.set(updated);
    this.saveSelectedIdentitiesToStorage(updated);
  }

  /**
   * Clear all selected identities
   */
  clearSelectedIdentities(): void {
    this._selectedIdentities.set([]);
    this.saveSelectedIdentitiesToStorage([]);
  }

  /**
   * Load selected identities from localStorage
   */
  private loadSelectedIdentitiesFromStorage(): void {
    try {
      const stored = localStorage.getItem('selected_identities');
      if (stored) {
        const identities = JSON.parse(stored) as IdentityDocumentsV2025[];
        this._selectedIdentities.set(identities);
      }
    } catch (error) {
      console.error('Failed to load selected identities from storage:', error);
    }
  }

  /**
   * Save selected identities to localStorage
   */
  private saveSelectedIdentitiesToStorage(identities: IdentityDocumentsV2025[]): void {
    try {
      localStorage.setItem('selected_identities', JSON.stringify(identities));
    } catch (error) {
      console.error('Failed to save selected identities to storage:', error);
    }
  }
}
