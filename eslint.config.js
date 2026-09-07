import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: ['node_modules/**', 'e2e/lib.browser.js', 'dist/**', '.private/**'],
	},
	{
		files: ['**/*.mjs'],
		languageOptions: {
			globals: globals.node,
		},
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
);
