import { Injectable, inject, signal } from '@angular/core';
import { IdentityV2025 } from 'sailpoint-api-client';

@Injectable({
  providedIn: 'root'
})
export class ReportDataService {
  // Use Angular 20 signals for reactive state
  identities = signal<IdentityV2025[]>([]);
  dataLoaded = signal<boolean>(false);
  isCompleteData = signal<boolean>(false);

  constructor() { }

  setIdentities(identities: IdentityV2025[], isCompleteDataset: boolean) {
    this.identities.set([...identities]);
    this.dataLoaded.set(true);
    this.isCompleteData.set(isCompleteDataset);
  }

  getIdentities(): IdentityV2025[] {
    return [...this.identities()]; // Return a copy to prevent direct modification
  }

  clearIdentities() {
    this.identities.set([]);
    this.dataLoaded.set(false);
    this.isCompleteData.set(false);
  }

  hasLoadedData(): boolean {
    return this.dataLoaded() && this.identities().length > 0;
  }

  isDataComplete(): boolean {
    return this.isCompleteData();
  }
}