// auto-save.service.ts
import { Injectable, signal } from '@angular/core';
import { cloneDeep, isEqual } from 'lodash-es';

export interface SavedTransform {
  id?: string;
  name: string;
  definition: any;
  lastModified: number;
  isNew: boolean;
  cloudVersion?: any; // Store the original cloud version for comparison
}

@Injectable({
  providedIn: 'root',
})
export class AutoSaveService {
  private readonly STORAGE_KEY = 'sailpoint_transforms_autosave';
  private readonly UNSAVED_CHANGES_KEY = 'sailpoint_transforms_unsaved';

  // Use Angular 20 signals for reactive state
  private _unsavedChanges = signal<Set<string>>(new Set());

  // Expose as readonly signal
  readonly unsavedChanges = this._unsavedChanges.asReadonly();

  constructor() {
    this.loadUnsavedChanges();
  }

  /**
   * Auto-save a transform locally
   */
  autoSave(
    transformId: string,
    name: string,
    definition: any,
    isNew: boolean = false,
    cloudVersion?: any
  ): void {
    const savedTransform: SavedTransform = {
      id: isNew ? undefined : transformId,
      name,
      definition,
      lastModified: Date.now(),
      isNew,
      cloudVersion,
    };

    const key = this.getStorageKey(transformId, isNew);
    localStorage.setItem(key, JSON.stringify(savedTransform));

    // Mark as having unsaved changes
    this.markAsUnsaved(transformId);

    console.log(`Auto-saved transform: ${name}`);
  }

  /**
   * Get locally saved transform
   */
  getLocalSave(
    transformId: string,
    isNew: boolean = false
  ): SavedTransform | null {
    const key = this.getStorageKey(transformId, isNew);
    const saved = localStorage.getItem(key);

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved) as SavedTransform;
    } catch (error) {
      console.error('Failed to parse saved transform:', error);
      return null;
    }
  }

  /**
   * Clear local save after successful cloud sync
   */
  clearLocalSave(transformId: string, isNew: boolean = false): void {
    const key = this.getStorageKey(transformId, isNew);
    localStorage.removeItem(key);

    // Remove from unsaved changes
    this.markAsSaved(transformId);

    console.log(`Cleared local save for transform: ${transformId}`);
  }

  /**
   * Get all locally saved transforms
   */
  getAllLocalSaves(): SavedTransform[] {
    const saves: SavedTransform[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_KEY)) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const transform = JSON.parse(saved) as SavedTransform;
            saves.push(transform);
          }
        } catch (error) {
          console.error('Failed to parse saved transform:', error);
        }
      }
    }

    return saves;
  }

  /**
   * Check if a transform has local changes
   */
  hasLocalChanges(transformId: string): boolean {
    return this._unsavedChanges().has(transformId);
  }

  /**
   * Check if a transform has unsaved changes compared to cloud version
   */
  hasUnsavedChanges(transformId: string, currentDefinition: any): boolean {
    const saved = this.getLocalSave(transformId);
    if (!saved) {
      return false;
    }

    // Compare current definition with saved definition
    const normalizedCurrent = this.normalizeDefinition(currentDefinition);
    const normalizedSaved = this.normalizeDefinition(saved.definition);

    return !isEqual(normalizedCurrent, normalizedSaved);
  }

  /**
   * Normalize definition for comparison by removing dynamic properties
   */
  private normalizeDefinition(def: any): any {
    if (!def) return def;

    const normalized = cloneDeep(def);

    // Remove properties that shouldn't affect comparison
    function deepCleanNames(obj: any): void {
      if (obj && typeof obj === 'object') {
        // Remove UID properties that are generated dynamically
        if (obj.id && typeof obj.id === 'string' && obj.id.startsWith('uid_')) {
          delete obj.id;
        }

        // Recursively clean nested objects
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach((item: any) => deepCleanNames(item));
            } else if (typeof obj[key] === 'object') {
              deepCleanNames(obj[key]);
            }
          }
        }
      }
    }

    deepCleanNames(normalized);
    return normalized;
  }

  /**
   * Get time since last save as a human-readable string
   */
  getTimeSinceLastSave(
    transformId: string,
    isNew: boolean = false
  ): string | null {
    const saved = this.getLocalSave(transformId, isNew);
    if (!saved) {
      return null;
    }

    const now = Date.now();
    const diff = now - saved.lastModified;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Generate storage key for a transform
   */
  private getStorageKey(transformId: string, isNew: boolean): string {
    const prefix = isNew ? 'new' : 'existing';
    return `${this.STORAGE_KEY}_${prefix}_${transformId}`;
  }

  /**
   * Mark a transform as having unsaved changes
   */
  private markAsUnsaved(transformId: string): void {
    const current = new Set(this._unsavedChanges());
    current.add(transformId);
    this._unsavedChanges.set(current);
    this.saveUnsavedChanges(current);
  }

  /**
   * Mark a transform as saved
   */
  private markAsSaved(transformId: string): void {
    const current = new Set(this._unsavedChanges());
    current.delete(transformId);
    this._unsavedChanges.set(current);
    this.saveUnsavedChanges(current);
  }

  /**
   * Save unsaved changes to localStorage
   */
  private saveUnsavedChanges(changes: Set<string>): void {
    localStorage.setItem(
      this.UNSAVED_CHANGES_KEY,
      JSON.stringify(Array.from(changes))
    );
  }

  /**
   * Load unsaved changes from localStorage
   */
  private loadUnsavedChanges(): void {
    try {
      const saved = localStorage.getItem(this.UNSAVED_CHANGES_KEY);
      if (saved) {
        const changes = JSON.parse(saved) as string[];
        this._unsavedChanges.set(new Set(changes));
      }
    } catch (error) {
      console.error('Failed to load unsaved changes:', error);
      this._unsavedChanges.set(new Set());
    }
  }

  /**
   * Clear all local saves (for testing or cleanup)
   */
  clearAllLocalSaves(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_KEY)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    this._unsavedChanges.set(new Set());
    this.saveUnsavedChanges(new Set());

    console.log('Cleared all local saves');
  }
}
