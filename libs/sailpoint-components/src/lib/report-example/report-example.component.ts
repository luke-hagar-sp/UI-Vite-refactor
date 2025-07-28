import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { IdentityV2025 } from 'sailpoint-api-client';
import { SailPointSDKService } from '../sailpoint-sdk.service';
import { ReportDataService } from './report-data.service';
import { ThemeService } from '../theme/theme.service';

// Import chart components
import { IdentityStatusChartComponent } from './identity-status-chart/identity-status-chart.component';
import { ManagerDistributionChartComponent } from './manager-distribution-chart/manager-distribution-chart.component';
import { LifecycleStateChartComponent } from './lifecycle-state-chart/lifecycle-state-chart.component';
import { AxiosResponse } from 'axios';

@Component({
  selector: 'app-report-example',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatDividerModule,
    IdentityStatusChartComponent,
    ManagerDistributionChartComponent,
    LifecycleStateChartComponent
  ],
  templateUrl: './report-example.component.html',
  styleUrl: './report-example.component.scss'
})
export class ReportExampleComponent implements OnInit, OnDestroy {
  // Inject services using Angular 20 inject() function
  private sdk = inject(SailPointSDKService);
  private dataService = inject(ReportDataService);
  private themeService = inject(ThemeService);

  title = 'Identity Analytics';

  loadingMessage = signal<string>('Loading identity data...');
  isCancelled = signal<boolean>(false);
  isLoadingComplete = signal<boolean>(false);
  isDark = signal<boolean>(false);

  // Data properties using signals
  identities = signal<IdentityV2025[]>([]);
  loading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  errorMessage = signal<string>('');
  totalLoaded = signal<number>(0);

  constructor() {
    // Use effect to react to theme changes
    effect(() => {
      const isDark = this.themeService.isDark();
      this.isDark.set(Boolean(isDark));
    });
  }

  ngOnInit() {
    // Check if data is already loaded in the service
    if (this.dataService.hasLoadedData()) {
      console.log('Using cached identity data');
      this.identities.set(this.dataService.getIdentities());
      this.totalLoaded.set(this.identities().length);
      this.isLoadingComplete.set(this.dataService.isDataComplete());
    } else {
      // No cached data, load from API
      void this.loadIdentities();
    }
  }

  cancelLoading() {
    this.isCancelled.set(true);
    console.log('Loading cancelled by user');
    this.loadingMessage.set('Loading cancelled. Displaying partial results...');
  }

  async loadIdentities() {
    this.loading.set(true);
    this.hasError.set(false);
    this.identities.set([]);
    this.isCancelled.set(false);
    this.isLoadingComplete.set(false);

    const BATCH_SIZE = 250; // API max limit
    const MAX_PARALLEL_REQUESTS = 8; // Number of parallel fetch threads
    let offset = 0;
    this.totalLoaded.set(0);

    try {
      // First, make one request to get an idea of the total count
      const initialResponse = await this.sdk.listIdentities({
        limit: BATCH_SIZE,
        offset: 0,
        count: true
      });

      const initialBatch = initialResponse.data || [];
      this.identities.set([...initialBatch]);
      this.totalLoaded.set(initialBatch.length);

      // If the first batch is less than BATCH_SIZE, we already have all the data
      if (initialBatch.length < BATCH_SIZE) {
        this.isLoadingComplete.set(true);
        console.log(`Completed loading ${this.identities().length} total identities`);
        this.dataService.setIdentities(this.identities(), this.isLoadingComplete());
        this.loading.set(false);
        return;
      }

      // Start with offset after the first batch
      offset = BATCH_SIZE;

      // Continue fetching batches in parallel until cancelled or no more data
      while (!this.isCancelled()) {
        this.loadingMessage.set(`Loading identities... (${this.totalLoaded()} loaded so far)`);

        // Create an array of promises for parallel requests
        const batchPromises: Promise<AxiosResponse<IdentityV2025[]>>[] = [];

        for (let i = 0; i < MAX_PARALLEL_REQUESTS && !this.isCancelled(); i++) {
          const currentOffset = offset + (i * BATCH_SIZE);

          // Create a promise for each batch request
          const batchPromise = this.sdk.listIdentities({
            limit: BATCH_SIZE,
            offset: currentOffset,
            count: true
          });

          batchPromises.push(batchPromise);
        }

        if (batchPromises.length === 0) {
          break; // Exit if no promises were created (cancelled)
        }

        // Wait for all parallel requests to complete
        const batchResponses = await Promise.all(batchPromises);

        // Process all responses
        let hasMoreData = false;

        for (const response of batchResponses) {
          const batchData = response.data || [];

          // Add the batch to our collected identities
          this.identities.update(current => [...current, ...batchData]);

          // Check if this batch indicates more data available
          if (batchData.length === BATCH_SIZE) {
            hasMoreData = true;
          }
        }

        this.totalLoaded.set(this.identities().length);

        // Update offset for next parallel batch
        offset += (BATCH_SIZE * MAX_PARALLEL_REQUESTS);

        // If no batch was full size, we've reached the end
        if (!hasMoreData) {
          this.isLoadingComplete.set(true);
          break;
        }
      }

      if (this.isCancelled()) {
        console.log(`Loading cancelled. Loaded ${this.identities().length} identities so far.`);
      } else {
        console.log(`Completed loading ${this.identities().length} total identities`);
        this.isLoadingComplete.set(true);
      }

      this.loadingMessage.set('Loading identity data...'); // Reset the message for next time

      // Store identities in the shared service with completion state
      this.dataService.setIdentities(this.identities(), this.isLoadingComplete());
    } catch (error) {
      this.hasError.set(true);
      this.errorMessage.set(`Error loading identities: ${String(error)}`);
    } finally {
      this.loading.set(false);
    }
  }


  refresh() {
    // Force reload from API, ignoring cache
    this.isCancelled.set(false);
    this.isLoadingComplete.set(false);
    void this.loadIdentities();
  }

  ngOnDestroy(): void {
    // No need to unsubscribe from signals as they are not RxJS subjects
  }
}
