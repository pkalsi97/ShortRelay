import globals from 'globals';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import yaml from 'yaml-eslint-parser';
import yml from 'eslint-plugin-yml';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.git/**',
      '*.config.js'
    ],
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  {
    files: ['**/*.{yml,yaml}'],
    languageOptions: {
      parser: yaml
    },
    plugins: {
      yml: yml
    },
    rules: {
      'yml/quotes': ['error', { 
        prefer: 'single',
        avoidEscape: true 
      }],
      'yml/no-empty-document': 'error'
    }
  }
];