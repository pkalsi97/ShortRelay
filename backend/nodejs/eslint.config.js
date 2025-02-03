import globals from 'globals';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
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
            '*.config.js',
            '*.config.ts',
        ],
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            parser: typescriptParser,
            globals: {
                ...globals.node,
            },
            parserOptions: {
                ecmaVersion: 2024,
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            'import': importPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: {},
                node: {
                    extensions: ['.js', '.mjs', '.ts', '.d.ts'],
                },
            },
        },
        rules: {
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'indent': ['error', 4],
            'comma-dangle': ['error', 'always-multiline'],
            'eol-last': ['error', 'always'],
            'no-trailing-spaces': 'error',
            "object-curly-spacing": ["error", "always"],
            "comma-spacing": ["error", { "before": false, "after": true }],
            "array-bracket-spacing": ["error", "never"],
            "arrow-spacing": ["error", { "before": true, "after": true }],
            "block-spacing": ["error", "always"],
            "func-call-spacing": ["error", "never"],
            "key-spacing": ["error", { 
                "beforeColon": false, 
                "afterColon": true 
            }],
            "keyword-spacing": ["error", { 
                "before": true, 
                "after": true 
            }],
            "line-comment-position": ["error", { 
                "position": "above" 
            }],
            "lines-between-class-members": ["error", "always"],
            'max-len': ['error', {
                code: 120,
                ignoreComments: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreRegExpLiterals: true,
            }],

            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],
            '@typescript-eslint/explicit-member-accessibility': ['error', {
                accessibility: 'explicit',
            }],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                },
                {
                    selector: ['enum', 'enumMember'],
                    format: ['PascalCase'],
                },
                {
                    selector: 'typeAlias',
                    format: ['PascalCase'],
                },
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
            ],

            'no-console': ['error', {
                allow: ['warn', 'error', 'info'],
            }],
            'no-debugger': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'curly': ['error', 'all'],
            'brace-style': ['error', '1tbs'],
            'prefer-template': 'error',
            'no-nested-ternary': 'error',
            'max-params': ['error', 6],
            'max-lines-per-function': ['error', {
                max: 150,
                skipBlankLines: true,
                skipComments: true,
            }],
            'complexity': ['error', 50],
            'import/order': ['error', {
                groups: [
                    'builtin',
                    'external',
                    'internal',
                    ['parent', 'sibling'],
                    'index',
                ],
                'newlines-between': 'always',
                alphabetize: {
                    order: 'asc',
                    caseInsensitive: true,
                },
            }],
            'import/no-duplicates': 'error',
            'import/no-unresolved': 'error',
            'import/no-cycle': 'error',
            'import/first': 'error',
            'no-async-promise-executor': 'error',
            'prefer-promise-reject-errors': 'error',
            'spaced-comment': ['error', 'always'],
        },
    },
    {
        files: ['**/*.{yml,yaml}'],
        languageOptions: {
            parser: yaml,
        },
        plugins: {
            yml: yml,
        },
        rules: {
            'yml/quotes': ['error', {
                prefer: 'single',
                avoidEscape: true,
            }],
            'yml/no-empty-document': 'error',
        },
    },
];