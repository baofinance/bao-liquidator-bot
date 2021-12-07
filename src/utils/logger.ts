import chalk from 'chalk'

export type LogLevel = 'error' | 'warning' | 'info' | 'success' | 'debug'
const _logLevelPrefix = (logLevel: LogLevel) =>
  logLevel === 'error'
    ? `${chalk.red('ERROR')} ${chalk.redBright('→')} `
    : logLevel === 'warning'
    ? `${chalk.yellow('WARNING')} ${chalk.yellowBright('→')} `
    : logLevel === 'info'
    ? `${chalk.cyan('INFO')} ${chalk.cyanBright('→')} `
    : logLevel === 'success'
    ? `${chalk.green('SUCCESS')} ${chalk.greenBright('→')} `
    : `${chalk.magenta('DEBUG')} ${chalk.magentaBright('→')} `

const log = (message: string, level?: LogLevel) =>
  console.log(_formatLogString(message, level))

const _formatLogString = (message: string, level: LogLevel = 'info') =>
  `[${chalk.blueBright(new Date().toISOString())}] `
    .concat(_logLevelPrefix(level))
    .concat(message)

const stdout = (newLine: string, level?: LogLevel) => {
  // @ts-ignore
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write(_formatLogString(newLine, level))
}

const newLine = () => process.stdout.write('\n')

const error = (message: string) => log(message, 'error')
const warning = (message: string) => log(message, 'warning')
const info = (message: string) => log(message, 'info')
const success = (message: string) => log(message, 'success')
const debug = (message: string) => log(message, 'debug')

export default {
  log,
  error,
  warning,
  info,
  success,
  debug,
  dynamicLog: stdout,
  newLine,
}
