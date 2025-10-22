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
            '*.test.ts',
            '*.mts',
            '*.config.*',
            'src/*/*.test.ts',
            'src/*.test.ts',
            'examples/*.test.ts',
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
);
