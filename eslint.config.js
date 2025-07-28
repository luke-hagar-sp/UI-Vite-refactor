import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import angularEslint from '@angular-eslint/eslint-plugin'
import angularTemplate from '@angular-eslint/eslint-plugin-template'
import angularTemplateParser from '@angular-eslint/template-parser'

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'out/**',
      '.gitignore',
      'eslint.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'libs/**/*.ts',
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        allowDefaultProject: true
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        Buffer: 'readonly'
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@angular-eslint': angularEslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...angularEslint.configs.recommended.rules,
      ...tseslint.configs['recommended-requiring-type-checking'].rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      "@typescript-eslint/no-unused-vars": "warn",
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      '@angular-eslint/directive-selector': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    }
  },
  {
    files: ['electron/**/*.{js,ts}', 'electron.vite.config.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        require: 'readonly'
      }
    }
  },
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    }
  },
  {
    files: ['electron/preload/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        process: 'readonly',
        console: 'readonly'
      }
    }
  },
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@angular-eslint': angularEslint,
      '@angular-eslint/template': angularTemplate
    },
    rules: {
      ...angularTemplate.configs.recommended.rules
    }
  }
] 