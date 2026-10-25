import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      // TypeScript already catches undefined references; no-undef doesn't
      // understand ambient DOM/TS globals and produces false positives.
      'no-undef': 'off',
      // A component's module-scope <script> (state shared by every mount) goes before
      // <script setup>: in the other order, no-useless-assignment reads the shared values as
      // never used. That failed CI twice before this rule.
      'vue/block-order': [
        'error',
        { order: ['script:not([setup])', 'script[setup]', 'template', 'style'] },
      ],
    },
  },
  eslintConfigPrettier,
)
