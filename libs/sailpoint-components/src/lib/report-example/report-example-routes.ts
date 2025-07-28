import { Routes } from '@angular/router';
import { ReportExampleComponent } from './report-example.component';
import { IdentityDetailViewComponent } from './identity-detail-view/identity-detail-view.component';

export const REPORT_EXAMPLE_ROUTES: Routes = [
  {
    path: '',
    component: ReportExampleComponent
  },
  {
    path: 'details',
    component: IdentityDetailViewComponent
  }
];