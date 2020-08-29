/*
 * @adonisjs/require-ts
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { addHook } from 'pirates'
import findCacheDir from 'find-cache-dir'

import { Cache } from './src/Cache'
import { Config } from './src/Config'
import { Compiler } from './src/Compiler'
import { loadTypescript } from './src/utils'

/**
 * Extensions to register require extension for
 */
const EXTS = ['.ts']
const CACHE_DIR_NAME = 'adonis-require-ts'

/**
 * Returns helpers to along with cache when using a watcher.
 *
 * - You can check if the tsconfig file inside the cache is stale or not.
 * 	 If it is stale, then clear the entire cache
 *
 * - Clear cache for a given file path.
 * - Clear all cache
 */
export function getWatcherHelpers(appRoot: string, cachePath?: string) {
	cachePath = cachePath || findCacheDir({ name: CACHE_DIR_NAME })
	const cache = new Cache(appRoot, cachePath!)

	return {
		clear(filePath?: string) {
			return filePath ? cache.clearForFile(filePath) : cache.clearAll()
		},
		isConfigStale: () => {
			const config = new Config(appRoot, cachePath!, {} as any, true)
			const { cached } = config.getCached()
			return !cached || cached.version !== Config.version
		},
	}
}

/**
 * Register hook to compile typescript files in-memory. When
 * caching is enabled, the compiled files will be written
 * on the disk
 */
export function register(
	appRoot: string,
	opts?: {
		cache?: boolean
		cachePath?: string
	}
) {
	/**
	 * Normalize options
	 */
	opts = Object.assign({ cache: false, cachePath: '' }, opts)
	if (opts.cache && !opts.cachePath) {
		opts.cachePath = findCacheDir({ name: CACHE_DIR_NAME })
	}

	const typescript = loadTypescript(appRoot)

	/**
	 * Cannot continue when config has errors
	 */
	const config = new Config(appRoot, opts.cachePath!, typescript, !!opts.cache).parse()
	if (config.error) {
		process.exit(1)
	}

	/**
	 * Instantiate compiler to compile `.ts` files using the typescript compiler. Currently
	 * we not resolve `.js` files and will never resolve `.tsx` or `.jsx` files.
	 */
	const compiler = new Compiler(appRoot, opts.cachePath!, typescript, config.options!, !!opts.cache)
	addHook(
		(code, filename) => {
			return compiler.compile(filename, code)
		},
		{ exts: EXTS, matcher: () => true }
	)
}
