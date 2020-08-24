/*
 * @adonisjs/require-ts
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { join } from 'path'
import ts from 'typescript'
import revisionHash from 'rev-hash'
import { Filesystem } from '@poppinss/dev-utils'

import { Config } from '../src/Config'

const fs = new Filesystem(join(__dirname, 'app'))

test.group('Config', (group) => {
	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('parse tsconfig and return compiler options back', async (assert) => {
		const cwd = join(__dirname, '..')
		const cacheRoot = join(fs.basePath, 'cache')

		const config = new Config(cwd, cacheRoot, ts)
		const options = config.parse()

		assert.isNull(options.error)
		assert.property(options.options, 'esModuleInterop')
		assert.property(options.options, 'configFilePath')
	})

	test('write compiled file to cache', async (assert) => {
		const cwd = join(__dirname, '..')
		const cacheRoot = join(fs.basePath, 'cache')

		const tsConfigContents = await fs.fsExtra.readFile(
			join(__dirname, '..', 'tsconfig.json'),
			'utf-8'
		)

		const config = new Config(cwd, cacheRoot, ts)
		const options = config.parse()

		const hasCacheFile = await fs.exists(`cache/tsconfig/${revisionHash(tsConfigContents)}.json`)

		assert.isNull(options.error)
		assert.isTrue(hasCacheFile)
		assert.property(options.options, 'esModuleInterop')
		assert.property(options.options, 'configFilePath')
	})

	test('do not write cache file when caching is disabled', async (assert) => {
		const cwd = join(__dirname, '..')
		const cacheRoot = join(fs.basePath, 'cache')

		const tsConfigContents = await fs.fsExtra.readFile(
			join(__dirname, '..', 'tsconfig.json'),
			'utf-8'
		)

		const config = new Config(cwd, cacheRoot, ts, false)
		const options = config.parse()

		const hasCacheFile = await fs.exists(`cache/tsconfig/${revisionHash(tsConfigContents)}.json`)

		assert.isNull(options.error)
		assert.isFalse(hasCacheFile)
		assert.property(options.options, 'esModuleInterop')
		assert.property(options.options, 'configFilePath')
	})

	test('return error when tsconfig file is missing', async (assert) => {
		const cwd = fs.basePath
		const cacheRoot = join(fs.basePath, 'cache')

		const config = new Config(cwd, cacheRoot, ts)
		const options = () => config.parse()
		assert.throw(
			options,
			'"@adonisjs/require-ts" expects the "tsconfig.json" file to exists in the app root'
		)
	})

	test('return error when tsconfig file is invalid', async (assert) => {
		const cwd = fs.basePath
		const cacheRoot = join(fs.basePath, 'cache')

		await fs.add(
			'tsconfig.json',
			JSON.stringify({
				extends: './node_modules/@adonisjs/mrm-preset/_tsconfig',
			})
		)

		const config = new Config(cwd, cacheRoot, ts)
		const { error, options } = config.parse()

		assert.isNull(options)
		assert.exists(error)
		assert.equal(
			error![0].messageText,
			`File './node_modules/@adonisjs/mrm-preset/_tsconfig' not found.`
		)
	})

	test('return compiler options from cache when exists', async (assert) => {
		const cwd = fs.basePath
		const cacheRoot = join(fs.basePath, 'cache')

		const tsConfigContents = JSON.stringify({
			extends: './node_modules/@adonisjs/mrm-preset/_tsconfig',
		})
		await fs.add('tsconfig.json', tsConfigContents)

		await fs.add(
			`cache/tsconfig/${revisionHash(tsConfigContents)}.json`,
			JSON.stringify({
				dummyValue: true,
			})
		)

		const config = new Config(cwd, cacheRoot, ts)
		const { error, options } = config.parse()

		assert.isNull(error)
		assert.deepEqual(options, { dummyValue: true })
	})

	test('ignore cache when caching is disabled', async (assert) => {
		const cwd = fs.basePath
		const cacheRoot = join(fs.basePath, 'cache')

		const tsConfigContents = JSON.stringify({
			extends: '../../node_modules/@adonisjs/mrm-preset/_tsconfig',
		})
		await fs.add('tsconfig.json', tsConfigContents)

		await fs.add(
			`cache/tsconfig/${revisionHash(tsConfigContents)}.json`,
			JSON.stringify({
				dummyValue: true,
			})
		)

		const config = new Config(cwd, cacheRoot, ts, false)
		const { error, options } = config.parse()

		assert.isNull(error)
		assert.notProperty(options, 'dummyValue')
	})

	test('ignore cache when source file has been changed', async (assert) => {
		const cwd = join(__dirname, '..')
		const cacheRoot = join(fs.basePath, 'cache')

		const tsConfigContents = JSON.stringify({
			extends: './node_modules/@adonisjs/mrm-preset/_tsconfig',
		})
		const hash = revisionHash(tsConfigContents)

		await fs.add(
			'tsconfig.json',
			JSON.stringify({
				extends: '../../node_modules/@adonisjs/mrm-preset/_tsconfig',
			})
		)
		await fs.add(
			`cache/${hash}.json`,
			JSON.stringify({
				dummyValue: true,
			})
		)

		const config = new Config(cwd, cacheRoot, ts)
		const { error, options } = config.parse()

		assert.isNull(error)
		assert.notProperty(options, 'dummyValue')
	})
})
