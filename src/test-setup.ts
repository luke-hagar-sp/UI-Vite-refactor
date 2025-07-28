import '@analogjs/vite-plugin-angular/setup-vitest'

import { getTestBed } from '@angular/core/testing'
import { BrowserTestingModule } from '@angular/platform-browser/testing'
import { platformBrowser } from '@angular/platform-browser'

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowser())
