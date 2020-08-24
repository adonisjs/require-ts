/*
 * @adonisjs/require-ts
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import tsStatic from 'typescript'
import sourceMapSupport from 'source-map-support'

import { debug } from '../utils'
import { Cache, FakeCache } from '../Cache'
import { DiagnosticsReporter } from '../DiagnosticsReporter'

/**
 * Exposes the API compile source files using the tsc compiler. No
 * type checking takes place.
 */
export class Compiler {
	/**
	 * In-memory compiled files cache for source maps to work.
	 */
	private memCache: Map<string, string> = new Map()

	/**
	 * Disk cache
	 */
	private cache = this.usesCache ? new Cache(this.appRoot, this.cacheRoot) : new FakeCache()

	/**
	 * Dignostic reporter to print program errors
	 */
	private diagnosticsReporter = new DiagnosticsReporter(this.appRoot, this.ts, false)

	constructor(
		private appRoot: string,
		private cacheRoot: string,
		private ts: typeof tsStatic,
		private compilerOptions: tsStatic.CompilerOptions,
		private usesCache: boolean = true
	) {
		this.patchCompilerOptions()
		this.setupSourceMaps()
	}

	/**
	 * Patch compiler options to make source map work properly
	 */
	private patchCompilerOptions() {
		/**
		 * Force inline source maps. We need this to avoid manual
		 * lookups
		 */
		this.compilerOptions.inlineSourceMap = true

		/**
		 * Inline sources
		 */
		this.compilerOptions.inlineSources = true

		/**
		 * Remove "outDir" property, so that the source maps paths are generated
		 * relative from the cwd and not the outDir.
		 *
		 * ts-node manually patches the source maps to use absolute paths. We cannot
		 * do same, since we cache files on the disk and changing the folder name
		 * of project root will corrupt the absolute path names inside the
		 * source maps.
		 */
		delete this.compilerOptions.outDir

		/**
		 * Inline source maps and source map cannot be used together
		 */
		delete this.compilerOptions.sourceMap
	}

	/**
	 * Setup source maps support to read from in-memory cache
	 */
	private setupSourceMaps() {
		sourceMapSupport.install({
			environment: 'node',
			retrieveFile: (pathOrUrl: string) => {
				debug('reading source for "%s"', pathOrUrl)
				return this.memCache.get(pathOrUrl) || ''
			},
		})
	}

	/**
	 * Compiles the file using the typescript compiler
	 */
	private compileFile(filePath: string, contents: string) {
		debug('compiling file using typescript "%s"', filePath)
		let { outputText, diagnostics } = this.ts.transpileModule(contents, {
			fileName: filePath,
			compilerOptions: this.compilerOptions,
			reportDiagnostics: true,
		})

		/**
		 * Report diagnostics if any
		 */
		if (diagnostics) {
			this.diagnosticsReporter.report(diagnostics)
		}

		/**
		 * Write to in-memory cache for sourcemaps to work
		 */
		this.memCache.set(filePath, outputText)
		return outputText
	}

	/**
	 * Compile typescript source code using the tsc compiler.
	 */
	public compile(filePath: string, contents: string) {
		debug('compiling file "%s"', filePath)
		const cachePath = this.cache.makeCachePath(filePath, contents, '.js')

		/**
		 * Return the file from cache when it exists
		 */
		const compiledContent = this.cache.get(cachePath)
		if (compiledContent) {
			/**
			 * Write to in-memory cache for sourcemaps to work
			 */
			this.memCache.set(filePath, compiledContent)
			return compiledContent
		}

		/**
		 * Compile file using the compiler
		 */
		const outputText = this.compileFile(filePath, contents)

		/**
		 * Write to cache on disk
		 */
		this.cache.set(cachePath, outputText)

		/**
		 * Return compiled text
		 */
		return outputText
	}
}
