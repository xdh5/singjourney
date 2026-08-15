import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default [
  {
    ignores: ['dist/**', '.generated-mini-program/**', 'src/static/workers/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    }
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        uni: 'readonly',
        wx: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/component-name-in-template-casing': ['error', 'kebab-case'],
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'always', normal: 'always', component: 'always' },
          svg: 'always',
          math: 'always'
        }
      ],
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['scripts/**/*.{js,mjs}', 'vite.config.ts'],
    languageOptions: { globals: globals.node }
  },
  prettier
]
