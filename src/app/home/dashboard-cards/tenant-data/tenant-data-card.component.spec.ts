import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantDataCardComponent } from './tenant-data-card.component';

describe('TenantDataCardComponent', () => {
  let component: TenantDataCardComponent;
  let fixture: ComponentFixture<TenantDataCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantDataCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantDataCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
