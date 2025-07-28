import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { IdentityV2025 } from 'sailpoint-api-client';
import { ReportDataService } from '../report-data.service';

@Component({
  selector: 'app-identity-detail-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatToolbarModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './identity-detail-view.component.html',
  styleUrl: './identity-detail-view.component.scss',
})
export class IdentityDetailViewComponent implements OnInit {
  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dataService = inject(ReportDataService);

  // Data properties
  displayedIdentities = signal<IdentityV2025[]>([]);
  allIdentities = signal<IdentityV2025[]>([]);
  loading = signal(true);
  filterCategory = signal('');
  filterValue = signal('');
  title = signal('');

  // Table configuration
  displayedColumns = signal<string[]>([
    'name',
    'alias',
    'emailAddress',
    'identityStatus',
    'lifecycleState',
  ]);
  pageSize = signal(10);
  pageIndex = signal(0);
  totalCount = signal(0);

  ngOnInit() {
    // Get the filter category and value from the route params
    this.route.queryParams.subscribe((params) => {
      this.filterCategory.set(params['category'] || '');
      this.filterValue.set(params['value'] || '');
      this.title.set(this.generateTitle(this.filterCategory(), this.filterValue()));

      this.loadFilteredIdentities();
    });
  }

  private loadFilteredIdentities() {
    this.loading.set(true);

    // Get all identities from the service
    const allIdentities = this.dataService.getIdentities();

    // Apply filtering based on category and value
    if (this.filterCategory() && this.filterValue()) {
      this.allIdentities.set(this.filterIdentities(
        allIdentities,
        this.filterCategory(),
        this.filterValue()
      ));
    } else {
      this.allIdentities.set([...allIdentities]);
    }

    this.totalCount.set(this.allIdentities().length);
    this.updateDisplayedIdentities();
    this.loading.set(false);
  }

  private filterIdentities(
    identities: IdentityV2025[],
    category: string,
    value: string
  ): IdentityV2025[] {
    return identities.filter((identity) => {
      switch (category) {
        case 'status':
          return identity.identityStatus === value;

        case 'manager':
          // For manager status (with/without)
          if (value === 'With Manager') {
            return identity.managerRef && identity.managerRef.id;
          } else {
            return !identity.managerRef || !identity.managerRef.id;
          }

        case 'lifecycle':
          // special case for "Unknown" filter
          if (value === 'Unknown') {
            // neither a populated lifecycleState nor a cloudLifecycleState attribute
            const hasStateName = !!identity.lifecycleState?.stateName;
            const hasCloud = !!(
              identity.attributes &&
              'cloudLifecycleState' in identity.attributes &&
              identity.attributes.cloudLifecycleState
            );
            return !hasStateName && !hasCloud;
          }

          // normal matching
          if (identity.lifecycleState?.stateName) {
            return identity.lifecycleState.stateName === value;
          }
          if (
            identity.attributes &&
            'cloudLifecycleState' in identity.attributes
          ) {
            return identity.attributes.cloudLifecycleState === value;
          }
          return false;

        default:
          return true;
      }
    });
  }

  private generateTitle(category: string, value: string): string {
    if (!category || !value) {
      return 'All Identities';
    }

    switch (category) {
      case 'status':
        return `Identities with Status: ${value}`;
      case 'manager':
        return `Identities ${value}`; // 'With Manager' or 'Without Manager'
      case 'lifecycle':
        return `Identities in Lifecycle State: ${value}`;
      default:
        return `Filtered Identities: ${value}`;
    }
  }

  private updateDisplayedIdentities() {
    const startIndex = this.pageIndex() * this.pageSize();
    this.displayedIdentities.set(this.allIdentities().slice(
      startIndex,
      startIndex + this.pageSize()
    ));
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.updateDisplayedIdentities();
  }

  sortData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      return;
    }

    this.allIdentities.set(this.allIdentities().sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'name':
          return this.compare(a.name || '', b.name || '', isAsc);
        case 'alias':
          return this.compare(a.alias || '', b.alias || '', isAsc);
        case 'emailAddress':
          return this.compare(
            a.emailAddress || '',
            b.emailAddress || '',
            isAsc
          );
        case 'identityStatus':
          return this.compare(
            a.identityStatus || '',
            b.identityStatus || '',
            isAsc
          );
        case 'lifecycleState': {
          const aState = a.lifecycleState?.stateName || '';
          const bState = b.lifecycleState?.stateName || '';
          return this.compare(aState, bState, isAsc);
        }
        default:
          return 0;
      }
    }));

    this.updateDisplayedIdentities();
  }

  private compare(a: string | number, b: string | number, isAsc: boolean) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  navigateBack() {
    void this.router.navigate(['/report-example']);
  }

  formatLifecycleState(identity: IdentityV2025): string {
    if (identity.lifecycleState && identity.lifecycleState.stateName) {
      return identity.lifecycleState.stateName;
    } else if (
      identity.attributes &&
      'cloudLifecycleState' in identity.attributes
    ) {
      return identity.attributes.cloudLifecycleState as string;
    }
    return 'Unknown';
  }
}
