import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { glob_to_regex } from './glob-to-regex.js'
import { str_argv_to_array } from './utils.js'
import { executor } from './executor.js'
import { to_array } from './utils.js'

export async function generate_tasks({
  cwd = process.cwd(),
  type = 'staged',
  rootPath = '',
  config = {},
  files = [],
} = {}) {
  const tasks = []

  for (const [pattern, cmds] of Object.entries(config)) {
    const matches = glob_to_regex(pattern, { extended: true, globstar: pattern.includes('/') })
    const is_fn = typeof cmds === 'function'
    const task_files = []
    const sub_tasks = []

    for (let file of files) {
      file = normalize(relative(cwd, normalize(resolve(rootPath, file)))).replace(/\\/g, '/')

      if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
        continue
      }

      if (matches.regex.test(file)) {
        task_files.push(resolve(cwd, file))
      }
    }

    const file_count = task_files.length
    const commands = to_array(is_fn ? await cmds({ filenames: task_files, type }) : cmds)
    const suffix = file_count ? file_count + (file_count > 1 ? ' files' : ' file') : 'no files'

    for (const command of commands) {
      const [cmd, ...args] = str_argv_to_array(command)

      if (file_count > 0) {
        sub_tasks.push({
          title: command,
          run: () =>
            executor(cmd, is_fn ? args : args.concat(task_files), {
              cwd: rootPath,
            }),
          pattern,
        })
      }
    }

    tasks.push({
      title: pattern + c.dim(` - ${suffix}`),
      tasks: sub_tasks,
      file_count,
    })
  }

  return tasks
}
