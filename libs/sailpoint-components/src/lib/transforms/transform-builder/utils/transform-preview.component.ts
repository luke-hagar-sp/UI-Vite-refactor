import { CommonModule } from '@angular/common';
import { Component, OnInit, Inject, inject, ViewEncapsulation, signal, effect } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { IdentityDocumentsV2025, IdentityProfilesV2025ApiGenerateIdentityPreviewRequest, IdentityProfileV2025, TransformsV2025ApiCreateTransformRequest } from 'sailpoint-api-client';
import { SailPointSDKService } from '../../../sailpoint-sdk.service';
import { IdentitySearchComponent } from './identity-search.component';
import { IdentityService } from './identity-service';
import { TransformResultsComponent } from './transform-results.component';

export type TransformResult = {
  identityName: string;
  result: string;
  success: boolean;
  error: string | null;
}

@Component({
  selector: 'app-preview-stepper',
  templateUrl: './transform-preview.component.html',
  styleUrl: './transform-preview.component.scss',
  standalone: true,
  imports: [MatButtonModule,
    MatStepperModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
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
    IdentitySearchComponent,
    TransformResultsComponent
  ],
  encapsulation: ViewEncapsulation.None,

})
export class TransformPreviewComponent implements OnInit {
  // Inject services using Angular 20 inject() function
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TransformPreviewComponent>);
  private identityService = inject(IdentityService);
  private snackBar = inject(MatSnackBar);

  sdk: SailPointSDKService;
  transformForm: FormGroup;
  profiles = signal<IdentityProfileV2025[]>([]);
  loadingProfiles = signal(false);
  profileError = signal('');
  selectedIdentities = signal<IdentityDocumentsV2025[]>([]);
  codeExpanded = signal(false);
  transformName = signal('');
  transformCode = signal('');
  executingTransform = signal(false);
  transformResults = signal<TransformResult[]>([]);

  constructor(@Inject(MAT_DIALOG_DATA) public data: { sdkService: SailPointSDKService, transformDefinition: any }) {
    this.sdk = data.sdkService;
    this.transformCode.set(data.transformDefinition);
    this.transformForm = this.fb.group({
      profileId: [null, (control: AbstractControl<any, any>) => Validators.required(control)],
    });

    if (typeof data.transformDefinition === 'string') {
      const parsed = JSON.parse(data.transformDefinition);

      if (
        parsed &&
        typeof parsed === 'object' &&
        'name' in parsed
      ) {
        this.transformName.set((parsed as { name: string }).name);
      } else {
        this.transformName.set('Transform');
      }
    } else {
      this.transformName.set('Transform');
    }
  }

  ngOnInit(): void {
    // Load profiles
    this.loadProfiles();

    // React to selected identities changes
    effect(() => {
      this.selectedIdentities.set(this.identityService.selectedIdentities());
    });

    // Check if there's saved profile selection
    const savedProfile = localStorage.getItem('selectedProfileId');
    if (savedProfile) {
      this.transformForm.patchValue({ profileId: savedProfile });
    }
  }

  private _formBuilder = inject(FormBuilder);

  firstFormGroup = this._formBuilder.group({
    firstCtrl: [null, (control: AbstractControl<any, any>) => Validators.required(control)],
  });
  secondFormGroup = this._formBuilder.group({
    secondCtrl: [null, (control: AbstractControl<any, any>) => Validators.required(control)],
  });

  cancel() {
    this.dialogRef.close();
  }

  async loadProfiles(): Promise<void> {
    this.loadingProfiles.set(true);
    this.profileError.set('');

    try {
      const response = await this.sdk.listIdentityProfiles();

      if (response.status >= 400) {
        this.profileError.set('Failed to load profiles');
        this.snackBar.open('Error loading profiles', 'Dismiss', {
          duration: 5000,
          panelClass: 'error-snackbar'
        });
        return;
      }

      console.log('Profiles loaded:', response);
      this.profiles.set(response.data);
    } catch (error: any) {
      this.profileError.set(error.message || 'Failed to load profiles');
      this.snackBar.open('Error loading profiles', 'Dismiss', {
        duration: 5000,
        panelClass: 'error-snackbar'
      });
    } finally {
      this.loadingProfiles.set(false);
    }
  }

  /**
 * Handle profile selection change
 */
  onProfileChange(profileId: string | null): void {
    if (profileId) {
      localStorage.setItem('selectedProfileId', profileId);
      // Clear selected identities when profile changes
      this.identityService.clearSelectedIdentities();
    } else {
      localStorage.removeItem('selectedProfileId');
    }
  }

  onIdentitiesSelected(identities: IdentityDocumentsV2025[]): void {
    this.selectedIdentities.set(identities);
  }

  /**
* Toggle code editor visibility
*/
  toggleCodeEditor(): void {
    this.codeExpanded.set(!this.codeExpanded());
  }

  async executeTransform(): Promise<void> {
    if (this.transformForm.invalid) {
      this.transformForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Dismiss', { duration: 3000 });
      return;
    }

    if (this.selectedIdentities().length === 0) {
      this.snackBar.open('Please select at least one identity', 'Dismiss', { duration: 3000 });
      return;
    }

    // Create transform to be used in the reference
    const transformDefinition = JSON.parse(this.transformCode());
    transformDefinition.name = transformDefinition.name + 'Preview';

    const createTransformRequest: TransformsV2025ApiCreateTransformRequest = {
      transformV2025: transformDefinition
    };

    const transformCreateResponse = await this.sdk.createTransform(createTransformRequest);
    if (transformCreateResponse.status >= 400) {
      this.snackBar.open('Error creating transform', 'Dismiss', { duration: 5000 });
      return;
    }

    this.executingTransform.set(true);
    this.transformResults.set([]);

    const previewPromises = this.selectedIdentities().map(async identity => {
      const request: IdentityProfilesV2025ApiGenerateIdentityPreviewRequest = {
        identityPreviewRequestV2025: {
          identityId: identity.id,
          identityAttributeConfig: {
            enabled: true,
            attributeTransforms: [
              {
                identityAttributeName: "email",
                transformDefinition: {
                  type: "reference",
                  attributes: {
                    id: transformDefinition.name
                  }
                }
              }
            ]
          }
        }
      };

      const response = await this.sdk.generateIdentityPreview(request);

      if (response.status >= 400) {
        this.transformResults.update(results => [...results, {
          identityName: identity.name,
          result: 'Error',
          success: false,
          error: response.statusText || 'An error occurred while generating the preview',
        }]);
      } else {
        const emailAttr = response.data.previewAttributes?.find(attr => attr.name === 'email');
        if (emailAttr?.errorMessages?.length) {
          this.transformResults.update(results => [...results, {
            identityName: identity.name,
            result: 'Error',
            success: false,
            error: emailAttr.errorMessages[0]?.text ?? 'Error message not available',
          }]);
        } else {
          this.transformResults.update(results => [...results, {
            identityName: identity.name,
            result: emailAttr?.value || 'No result',
            success: true,
            error: null,
          }]);
        }
      }
    });

    // Wait for all previews to complete
    await Promise.all(previewPromises);

    // Now it's safe to delete the transform
    const deleteTransformResponse = await this.sdk.deleteTransform({ id: transformCreateResponse.data.id });

    if (deleteTransformResponse.status >= 400) {
      this.snackBar.open('Error deleting transform', 'Dismiss', { duration: 5000 });
      return;
    }

    console.log('Transform results:', this.transformResults());

    this.executingTransform.set(false);
  }

  resetForm(): void {
    this.transformForm.reset();
    this.identityService.clearSelectedIdentities();
    this.identityService.updateSelectedIdentities([]);
    this.transformResults.set([]);
    localStorage.removeItem('selectedProfileId');
  }

  onTransformCodeChange(): void {
    // handle transform code changes if needed
  }
}
