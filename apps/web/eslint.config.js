// Lint del front (React). Lo ejecuta el pipeline estándar con `npm run lint`.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      // Avisa (no bloquea): cambiar estado en un efecto, típico de "cargando…".
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // Las configs de Vite y Vitest corren en Node.
  { files: ['vite.config.js', 'vitest.config.js'], languageOptions: { globals: globals.node } },
];
