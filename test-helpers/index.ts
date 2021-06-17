/*
 * @adonisjs/require-ts
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import stripAnsi from 'strip-ansi'
import testConsole from 'test-console'

export function stringToArray(value: string) {
  return value.split('\n').map((line) => line.trim())
}

export function inspectConsole() {
  const stdoutOutput = testConsole.stdout.inspect()
  const stderrOutput = testConsole.stderr.inspect()
  return () => {
    stdoutOutput.restore()
    stderrOutput.restore()
    return {
      stdout: stdoutOutput.output
        .map((line) => stripAnsi(line))
        .filter((line) => !line.trim().startsWith('adonis:require-ts')),
      stderr: stderrOutput.output
        .map((line) => stripAnsi(line))
        .filter((line) => !line.trim().startsWith('adonis:require-ts')),
    }
  }
}
