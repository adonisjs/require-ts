/*
 * @adonisjs/require-ts
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import tsStatic from 'typescript'
import { readFileSync } from 'fs-extra'

import { debug } from '../utils'
import { Cache, FakeCache } from '../Cache'
import { DiagnosticsReporter } from '../DiagnosticsReporter'

/**
 * Exposes the API to parse tsconfig file and cache it until the
 * contents of the file are changed.
 */
export class Config {
	/**
	 * Hard assumption has been made that config file name
	 * is "tsconfig.json"
	 */
	private configFilePath = join(this.appRoot, 'tsconfig.json')

	/**
	 * Reference to the cache
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
		private usesCache: boolean = true
	) {}

	/**
	 * Returns the raw contents of the config file. We need to read this
	 * always to generate the hash and then look for the cached config
	 * file.
	 */
	private getConfigRawContents(): string {
		debug('checking for tsconfig "%s"', this.configFilePath)
		try {
			return readFileSync(this.configFilePath, 'utf-8')
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(
					'"@adonisjs/require-ts" expects the "tsconfig.json" file to exists in the app root'
				)
			}

			throw error
		}
	}

	/**
	 * Parses the ts config using the typescript compiler
	 */
	private parseTsConfig(): { error: null | tsStatic.Diagnostic[]; options: any } {
		let exception: any = null
		debug('parse tsconfig file')

		/**
		 * Parse config using typescript compiler
		 */
		const config = this.ts.getParsedCommandLineOfConfigFile(
			this.configFilePath,
			{},
			{
				...this.ts.sys,
				useCaseSensitiveFileNames: true,
				getCurrentDirectory: () => this.appRoot,
				onUnRecoverableConfigFileDiagnostic: (error: any) => (exception = error),
			}
		)

		/**
		 * Return exception as it is
		 */
		if (exception) {
			return {
				error: exception,
				options: null,
			}
		}

		/**
		 * Return diagnostic errors if any
		 */
		if (config!.errors && config!.errors.length) {
			return {
				error: config!.errors,
				options: null,
			}
		}

		/**
		 * Return compiler options
		 */
		return {
			error: null,
			options: config!.options,
		}
	}

	/**
	 * Parses the cached config string as JSON. Errors
	 * are ignored and hence cache is ignored too
	 */
	private parseConfigAsJson(config: string | null) {
		if (!config) {
			return null
		}

		try {
			return JSON.parse(config)
		} catch (error) {
			return null
		}
	}

	/**
	 * Parses config and returns the compiler options
	 */
	public parse(): {
		options: null | tsStatic.CompilerOptions
		error: null | tsStatic.Diagnostic[]
	} {
		const cachePath = this.cache.makeCachePath(
			this.configFilePath,
			this.getConfigRawContents(),
			'.json'
		)

		/**
		 * Cache exists and is upto date
		 */
		const cached = this.parseConfigAsJson(this.cache.get(cachePath))
		if (cached) {
			return {
				error: null,
				options: cached,
			}
		}

		/**
		 * Parse the config using the compiler
		 */
		const config = this.parseTsConfig()
		if (config.error) {
			this.diagnosticsReporter.report(config.error)
			return config
		}

		/**
		 * Write to cache to avoid future parsing
		 */
		this.cache.set(cachePath, JSON.stringify(config.options))
		return {
			error: null,
			options: config.options,
		}
	}
}
