import c from 'picocolors'

export function create_logger(std = process.stderr) {
  const logger = {
    log(event) {
      const type = event.type
      switch (type) {
        default: {
          throw new Error(`Unknown event type: ${type}`)
        }
        case 'failure': {
          const reason = event.reason
          switch (reason) {
            default: {
              throw new Error(`Unknown failure reason: ${reason}`)
            }
            case 'no-config': {
              console.error(c.red('× Create Nano Staged config.'))
              break
            }
            case 'no-file-config': {
              console.error(
                c.red(`×  Nano Staged config file ${c.yellow(event.file)} is not found.`)
              )
              break
            }
            case 'invalid-config': {
              console.error(c.red('× Nano Staged config invalid.'))
              break
            }
            case 'no-git-repo': {
              console.error(c.red('× Nano Staged didn’t find git directory.'))
              break
            }
          }
          break
        }
        case 'output': {
          const stream = event.stream
          switch (stream) {
            default: {
              throw new Error(`Unknown output stream: ${stream}`)
            }
            case 'stderr': {
              std.write(event.data)
              break
            }
          }
          break
        }
        case 'info': {
          const detail = event.detail
          switch (detail) {
            default: {
              throw new Error(`Unknown info event detail: ${detail}`)
            }
            case 'no-files': {
              console.log(`${c.cyan(`-`)} No ${event.runner_type} files found.`)
              break
            }
            case 'no-matching-files': {
              console.log(`${c.cyan(`-`)} No files match any configured task.`)
              break
            }
          }
        }
      }
    },
  }

  return logger
}
