import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ['bundle.js', 'eslint.config.js', 'out/**/*', 'public/**/*', 'data/**/*', 'src/3rdparty/**/*', 'src/**/*.test.ts', 'src/**/*.bench.ts']
    },
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended, // recommendedTypeChecked
    // {
    //   languageOptions: {
    //     parserOptions: {
    //       projectService: true,
    //       tsconfigRootDir: import.meta.dirname,
    //     },
    //   }
    // },
    {
        settings: {
            'import/resolver': {
                node: true,
                typescript: true
            }
        }
    },
    {
        /**
         * NO DYNAMIC "#/" IMPORTS IN tools/.
         *
         * package.json maps "#/*" to "./src/*", and that key is invalid to Node: the imports
         * field forbids keys that are "#" or start with "#/". It works at all only because tsx
         * rewrites STATIC imports at transform time. A dynamic import('#/...') is handed to
         * Node's real resolver instead, and the module graph it pulls in spawns a worker thread
         * which re-resolves the same shape natively and throws ERR_INVALID_MODULE_SPECIFIER out
         * of a nextTick - past every catch, killing the process.
         *
         * That cost three sims silently: ectophial.ts died after five checks, and blowpipe.ts and
         * huntgaps.ts printed NOTHING AT ALL and exited 1 with no failure named anywhere (181
         * checks were not running). In tools/ this failure is invisible - a sim that stops
         * measuring looks the same as a sim with nothing to say - which is why the rule is scoped
         * here. src/ has none today, and one there would break the live server loudly.
         *
         * "#tools/*" and "#3rdparty/*" are NOT affected and are deliberately still allowed: they
         * do not start with "#/", so they are valid Node keys and resolve dynamically just fine -
         * tools/pack/PackAll.ts relies on that.
         */
        files: ['tools/**/*.ts', 'tools/**/*.js', 'tools/**/*.mts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ImportExpression > Literal[value=/^#\\//]',
                    message: "Dynamic import('#/...') is not resolvable by Node and kills the process from a worker thread - import it statically at the top of the file instead. ('#tools/...' and '#3rdparty/...' are fine.)"
                }
            ]
        }
    },
    {
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],

            // todo: re-enable later (cleaner code)
            'no-useless-assignment': 'off',

            /**
             * https://eslint.org/docs/latest/rules/no-constant-condition#checkloops
             *
             * Allows constant conditions in loops but not in if statements
             */
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-case-declarations': 'error',
            '@typescript-eslint/no-namespace': 'error',
            /**
             * (jkm)
             * The following rule is included in @typescript-eslint/recommended
             * I have set it to warn instead of error, to avoid having to fix it
             * We should consider fixing it and setting it to error
             */
            '@typescript-eslint/no-explicit-any': 'warn',

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    /**
                     * Allow variables prefixed with underscores to skip this rule.
                     * There aren't many good reasons to have unused variables,
                     * but the codebase has 100s of them.
                     */
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    /**
                     * Allow parameters prefixed with underscores to skip this rule.
                     * This is a common practice for router methods with req and res parameters.
                     */
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_'
                }
            ]
        }
    }
];
