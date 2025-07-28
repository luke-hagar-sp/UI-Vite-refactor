import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SailpointComponentsComponent } from './sailpoint-components.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SailpointComponentsComponent', () => {
  let component: SailpointComponentsComponent;
  let fixture: ComponentFixture<SailpointComponentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SailpointComponentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SailpointComponentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
