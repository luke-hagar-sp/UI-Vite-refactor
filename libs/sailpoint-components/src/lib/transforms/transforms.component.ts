import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import {
  TransformReadV2025,
  TransformsV2025ApiDeleteTransformRequest,
} from 'sailpoint-api-client';
import { GenericDialogComponent } from '../generic-dialog/generic-dialog.component';
import { SailPointSDKService } from '../sailpoint-sdk.service';
import { TransformBuilderComponent } from './transform-builder/transform-builder.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-transforms',
  standalone: true,
  imports: [
    MatTableModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatButtonModule,
    TransformBuilderComponent,
    MatSnackBarModule,
    MatToolbarModule,
    MatIconModule
  ],
  templateUrl: './transforms.component.html',
  styleUrl: './transforms.component.scss',
})
export class TransformsComponent implements OnInit {
  title = 'Transforms';

  // Inject services using Angular 20 inject() function
  private dialog = inject(MatDialog);
  private sdk = inject(SailPointSDKService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  // Use Angular 20 signals for reactive state
  transforms = signal<TransformReadV2025[]>([]);
  dataSource = signal<MatTableDataSource<TransformReadV2025>>(new MatTableDataSource());
  displayedColumns = signal<string[]>(['id', 'name', 'type', 'internal', 'actions']);
  loading = signal<boolean>(false);
  hasDataLoaded = signal<boolean>(false);
  transform = signal<TransformReadV2025 | undefined>(undefined);
  editing = signal<boolean>(false);

  @ViewChild(TransformBuilderComponent)
  transformBuilder?: TransformBuilderComponent;

  constructor() { }

  ngOnInit() {
    void this.loadTransforms();
  }

  private async loadTransforms(): Promise<void> {
    console.log('loading transforms');
    this.loading.set(true);
    this.hasDataLoaded.set(false);

    console.log('loading', this.loading());
    console.log('hasDataLoaded', this.hasDataLoaded());

    try {
      const response = await this.sdk.listTransforms();
      const filteredTransforms = response.data.filter((transform) => transform.internal !== true) ?? [];
      console.log('filteredTransforms', filteredTransforms);
      this.transforms.set(filteredTransforms);
      this.dataSource.set(new MatTableDataSource(filteredTransforms));
      this.hasDataLoaded.set(true);

      console.log('loading', this.loading());
      console.log('hasDataLoaded', this.hasDataLoaded());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.openMessageDialog(`Error loading transforms: ${message}`, 'Error');
    } finally {
      this.loading.set(false);
    }
  }

  openMessageDialog(errorMessage: string, title: string): void {
    this.dialog.open(GenericDialogComponent, {
      data: {
        title: title,
        message: errorMessage,
      },
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource().filter = filterValue.trim().toLowerCase();
  }

  confirmBack(): void {
    if (this.transformBuilder?.hasUnsavedChanges) {
      const dialogRef = this.dialog.open(GenericDialogComponent, {
        width: '400px',
        data: {
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Are you sure you want to leave?',
          isConfirmation: true,
        },
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.editing.set(false);
          this.transform.set(undefined);
        }
      });
    } else {
      this.editing.set(false);
      this.transform.set(undefined);
    }
  }

  onEdit(transform?: TransformReadV2025): void {
    this.transform.set(transform);
    this.editing.set(true);
  }

  async onDelete(transform: TransformReadV2025): Promise<void> {
    const dialogRef = this.dialog.open(GenericDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Delete',
        message: `Are you sure you want to delete transform "${transform.name}"?`,
        isConfirmation: true,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          const request: TransformsV2025ApiDeleteTransformRequest = {
            id: transform.id,
          };
          await this.sdk.deleteTransform(request);
          this.snackBar.open('Transform deleted successfully', 'Close', {
            duration: 3000,
          });
          void this.loadTransforms();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.openMessageDialog(`Error deleting transform: ${message}`, 'Error');
        }
      }
    });
  }
}