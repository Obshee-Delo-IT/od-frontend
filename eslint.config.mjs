import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [{
  // Global ignores (an `ignores`-only entry). `/.scratch/` is the sanctioned
  // dumping ground for transient local artefacts — prototypes, Figma exports,
  // smoke-run scripts — and is gitignored, so CI never sees it. Without this,
  // `pnpm lint` fails locally on throwaway code while passing in CI, which
  // makes the gate useless exactly where it runs most often.
  ignores: ['.scratch/**'],
}, ...nextCoreWebVitals, ...nextTypescript, eslintConfigPrettier, {
  ignores: ['./.next/**/*.ts', './.next/**/*.js'],
  rules: {
    ...reactHooksPlugin.configs.recommended.rules,
    'react/prop-types': 'off',
    'react/jsx-filename-extension': [
      1,
      {
        extensions: ['.tsx', '.jsx'],
      },
    ],
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      },
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react/hook-use-state': [
      'error',
      {
        allowDestructuredState: false,
      },
    ],
    'react/iframe-missing-sandbox': 'warn',
    'react/jsx-boolean-value': 'error',
    'react/jsx-child-element-spacing': 'warn',
    'react/jsx-curly-brace-presence': [
      'warn',
      {
        props: 'never',
        children: 'never',
        propElementValues: 'always',
      },
    ],
    'react/jsx-fragments': ['warn', 'syntax'],
    'react/self-closing-comp': ['warn'],
    '@typescript-eslint/no-namespace': 'off',
    'import/no-cycle': 'error',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/order': [
      'error',
      {
        groups: [['external', 'builtin'], 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-default-export': 'off',
    'no-plusplus': 'error',
    curly: ['error', 'all'],
    'no-console': 'warn',
    'arrow-body-style': ['error', 'as-needed'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
}, {
  // Standalone Node CLI scripts (film worksheet export/import): printing to the
  // terminal is their whole job, and ESM needs the file extension on imports.
  files: ['scripts/**/*.mjs'],
  rules: {
    'no-console': 'off',
    'import/extensions': 'off',
  },
}];

export default eslintConfig;
