import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { GenericDialogComponent } from './generic-dialog/generic-dialog.component';
import { IdentitiesComponent } from './identities/identities.component';
import { ReportExampleComponent } from './report-example/report-example.component';
import { ThemePickerComponent } from './theme-picker/theme-picker.component';
import { TransformBuilderComponent } from './transforms/transform-builder/transform-builder.component';
import { TransformsComponent } from './transforms/transforms.component';
import { VelocityEditorDialogComponent } from './velocity-editor-dialog/velocity-editor-dialog.component';

const COMPONENTS = [
  GenericDialogComponent,
  IdentitiesComponent,
  ReportExampleComponent,
  ThemePickerComponent,
  TransformBuilderComponent,
  TransformsComponent,
  VelocityEditorDialogComponent
];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ...COMPONENTS
  ],
  exports: COMPONENTS
})
export class UiComponentsModule { } 