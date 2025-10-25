import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/*.json', '**/*.jsonc'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          // Need this to stop:
          //   0:0  error  Parsing error: /Volumes/CODE/@axhxrx/ops/Op.test.ts was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject
          // Allow specific directories without ** glob to avoid performance warning
          allowDefaultProject: [
            '*.config.*',
          ],
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'object-shorthand': [
        'error',
        'always',
        {
          avoidQuotes: true,
          ignoreConstructors: false,
        },
      ],
    },
  },
  // How do I disable type-checked linting for a file?
  // https://typescript-eslint.io/troubleshooting/typed-linting/#how-do-i-disable-type-checked-linting-for-a-file
  // Because otherwise the defaultProject type-checked linting goes batshit
  // /Volumes/CODE/@axhxrx/ops/stripAnsi.test.ts
  //   0:0  error  Parsing error: Too many files (>8) have matched the default project.
  //
  // Having many files run with the default project is known to cause performance issues and slow down linting.
  //
  // See https://typescript-eslint.io/troubleshooting/typed-linting#allowdefaultproject-glob-too-wide
  {
    files: ['**/*.test.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
