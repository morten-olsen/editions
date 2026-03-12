import { FlatCompat } from '@eslint/eslintrc';
import importPlugin from 'eslint-plugin-import';
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: import.meta.dirname,
});

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [importPlugin.flatConfigs.recommended, importPlugin.flatConfigs.typescript],
    rules: {
      // Import rules (from coding-standards.md)
      'import/no-unresolved': 'off',
      'import/extensions': ['error', 'ignorePackages'],
      'import/exports-last': 'error',
      'import/no-default-export': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
  {
    rules: {
      // TypeScript rules (from coding-standards.md)
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Naming conventions (from coding-standards.md)
      '@typescript-eslint/naming-convention': [
        'error',
        // Types and interfaces: PascalCase
        { selector: 'typeLike', format: ['PascalCase'] },
        // Type parameters (generics): PascalCase
        { selector: 'typeParameter', format: ['PascalCase'] },
        // Variables: camelCase or UPPER_CASE, allow PascalCase for React components and destructured types
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          filter: { regex: '^__', match: false }, // Exclude __filename, __dirname
        },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        // Functions: camelCase or PascalCase (for React components)
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        // Class members: camelCase (but allow # private fields)
        { selector: 'classProperty', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'classMethod', format: ['camelCase'] },
      ],

      // Complexity and readability
      complexity: ['error', 15],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],

      // Enforce # private fields over private keyword (from coding-standards.md)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration',
          message: 'Use arrow function syntax instead of function declarations (coding-standards.md)',
        },
        {
          selector: 'PropertyDefinition[accessibility="private"]',
          message: 'Use # for private fields instead of the private keyword',
        },
        {
          selector: 'MethodDefinition[accessibility="private"]',
          message: 'Use # for private methods instead of the private keyword',
        },
      ],
    },
  },
  {
    // .d.ts files need interfaces and triple-slash references
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },
  {
    // Config files typically require default exports
    files: ['**/*.config.ts', '**/*.config.mjs', '**/*.config.js', '**/vitest.workspace.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // Storybook CSF requires default export for meta, and exports-last conflicts with story definitions
    files: ['**/*.stories.tsx', '**/.storybook/*.ts'],
    rules: {
      'import/no-default-export': 'off',
      'import/exports-last': 'off',
    },
  },
  {
    // Tests, stories, and migrations are naturally long — relax size limits
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.tsx', '**/migrations/*.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // Generated files — not hand-authored
    files: ['**/api.types.ts', '**/.astro/**'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-restricted-types': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // React-specific rules for frontend
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
    },
  },
  ...compat.extends('plugin:prettier/recommended'),
  {
    // Enforce braces for all control statements (must be after prettier, which disables it)
    rules: {
      curly: ['error', 'all'],
    },
  },
  {
    ignores: ['**/node_modules/', '**/dist/', '**/.claude/', '**/.arc/', '**/storybook-static/', '**/.tanstack/'],
  },
);
