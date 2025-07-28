import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})


export class ElectronService {
  isElectron: boolean = false;
  electronAPI: any;

  constructor() {
    // Setup the electronAPI
    console.log('window.electronAPI', window.electronAPI);
    if (window.electronAPI) {
      this.electronAPI = window.electronAPI;
      this.isElectron = true;
    } else {
      console.error('Electron API is not available');
    }
  }
}
