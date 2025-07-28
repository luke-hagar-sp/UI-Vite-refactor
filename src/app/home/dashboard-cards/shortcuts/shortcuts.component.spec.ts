import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortcutsComponent } from './shortcuts.component';

describe('ShortcutsComponent', () => {
  let component: ShortcutsComponent;
  let fixture: ComponentFixture<ShortcutsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortcutsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShortcutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 8 shortcuts defined', () => {
    expect(component.shortcuts.length).toBe(8);
  });

  it('should call action when shortcut is clicked', () => {
    const shortcut = component.shortcuts[0];
    const spy = spyOn(shortcut, 'action');
    
    component.onShortcutClick(shortcut);
    
    expect(spy).toHaveBeenCalled();
  });
}); 