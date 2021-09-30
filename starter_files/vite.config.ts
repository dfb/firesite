import { defineConfig, UserConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import sveltePreprocess from 'svelte-preprocess';
import legacy from '@vitejs/plugin-legacy';
import autoprefixer from 'autoprefixer';

const production = process.env.NODE_ENV === 'production';
const config = <UserConfig> defineConfig({
    plugins: [
        svelte({
            emitCss: production,
            preprocess: sveltePreprocess(),
            compilerOptions: {
                dev: !production,
            },

            // @ts-ignore This is temporary until the type definitions are fixed!
            hot: !production
        }),
    ],
    server: {
        host: 'localhost',
        port: 5000
    },
    build: {
        sourcemap: false
    },
    css: {
        postcss: {
            plugins: [
                autoprefixer()
            ]
        }
    }
});

// Babel
if (0) {
    config.plugins.unshift(
        legacy({
            targets: ['defaults']
        })
    );
}

const aliases = {"src/*": ["src/*"]};
for (const alias in aliases) {
    const paths = aliases[alias].map((p: string) => path.resolve(__dirname, p));

    // Our tsconfig uses glob path formats, whereas webpack just wants directories
    // We'll need to transform the glob format into a format acceptable to webpack

    const wpAlias = alias.replace(/(\\|\/)\*$/, '');
    const wpPaths = paths.map((p: string) => p.replace(/(\\|\/)\*$/, ''));

    if (!config.resolve) config.resolve = {};
    if (!config.resolve.alias) config.resolve.alias = {};

    if (config.resolve && config.resolve.alias && !(wpAlias in config.resolve.alias)) {
        config.resolve.alias[wpAlias] = wpPaths.length > 1 ? wpPaths : wpPaths[0];
    }
}

export default config;

