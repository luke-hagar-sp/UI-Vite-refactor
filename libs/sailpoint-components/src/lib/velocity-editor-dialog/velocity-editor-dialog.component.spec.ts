import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VelocityEditorDialogComponent } from './velocity-editor-dialog.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('VelocityEditorDialogComponent', () => {
  let component: VelocityEditorDialogComponent;
  let fixture: ComponentFixture<VelocityEditorDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VelocityEditorDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VelocityEditorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
