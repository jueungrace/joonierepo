module.exports = {
	root: true,
	extends: ['custom'],
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['node_modules'],
	overrides: [{ files: ['*.svelte'], processor: 'svelte3/svelte3' }],
	settings: {
		'svelte3/typescript': require('typescript'),
		'svelte3/ignore-styles': () => true
	},
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
		extraFileExtensions: ['.svelte']
	},
	env: {
		es6: true,
		browser: true
	}
};
