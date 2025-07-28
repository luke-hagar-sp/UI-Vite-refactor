import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransformBuilderComponent } from './transform-builder.component';
import { describe, expect, it, beforeEach } from 'vitest';

describe('BuilderComponent', () => {
  let component: TransformBuilderComponent;
  let fixture: ComponentFixture<TransformBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransformBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransformBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
