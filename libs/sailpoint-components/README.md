# UI Components Library

A modern Angular component library built with Tailwind CSS v4 for the Angular Electron Vite application.

## Installation

This library is part of the monorepo and can be used directly in the main application.

## Usage

### Import the Module

```typescript
import { UiComponentsModule } from 'sailpoint-components';

@NgModule({
  imports: [UiComponentsModule],
  // ...
})
export class AppModule { }
```

### Or Import Individual Components (Standalone)

```typescript
import { ButtonComponent, CardComponent, InputComponent } from 'sailpoint-components';

@Component({
  imports: [ButtonComponent, CardComponent, InputComponent],
  // ...
})
export class MyComponent { }
```

## Components

### Button Component

```html
<ui-button variant="primary" size="md" (onClick)="handleClick($event)">
  Click me
</ui-button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean
- `type`: 'button' | 'submit' | 'reset'

### Card Component

```html
<ui-card header="Card Title" subtitle="Card subtitle" shadow="md">
  <p>Card content goes here</p>
  
  <div ui-card-footer>
    <ui-button variant="primary">Action</ui-button>
  </div>
</ui-card>
```

**Props:**
- `header`: string
- `subtitle`: string
- `footer`: boolean
- `shadow`: 'sm' | 'md' | 'lg' | 'xl'

### Input Component

```html
<ui-input 
  label="Email"
  placeholder="Enter your email"
  type="email"
  required
  [(ngModel)]="email"
  error="Please enter a valid email"
>
</ui-input>
```

**Props:**
- `label`: string
- `placeholder`: string
- `type`: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
- `disabled`: boolean
- `required`: boolean
- `error`: string
- `hint`: string
- `size`: 'sm' | 'md' | 'lg'

## Development

### Build the Library

```bash
cd libs/ui-components
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### Test

```bash
npm run test
```

### Lint

```bash
npm run lint
```

## Features

- ✅ Built with Angular standalone components
- ✅ Tailwind CSS v4 integration
- ✅ Dark mode support
- ✅ Accessibility features
- ✅ Form integration
- ✅ TypeScript support
- ✅ Responsive design 