import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { glob_to_regex } from './glob-to-regex.js'
import { str_argv_to_array } from './utils.js'
import { NanoStagedError } from './error.js'
import { executor } from './executor.js'
import { to_array } from './utils.js'

export function create_cmd_runner({
  cwd = process.cwd(),
  type = 'staged',
  rootPath = '',
  config = {},
  files = [],
} = {}) {
  const runner = {
    async generate_cmd_tasks() {
      const cmd_tasks = []

      for (const [pattern, cmds] of Object.entries(config)) {
        const matches = glob_to_regex(pattern, { extended: true, globstar: pattern.includes('/') })
        const is_fn = typeof cmds === 'function'
        const task_files = []
        const tasks = []

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
            tasks.push({
              title: command,
              run: async () =>
                executor(cmd, is_fn ? args : args.concat(task_files), {
                  cwd: rootPath,
                }),
              pattern,
            })
          }
        }

        cmd_tasks.push({
          title: pattern + c.dim(` - ${suffix}`),
          file_count,
          tasks,
        })
      }

      return cmd_tasks
    },

    async run(parent_task) {
      const errors = []

      try {
        await Promise.all(
          parent_task.tasks.map(async (task) => {
            task.parent = parent_task

            try {
              if (task.file_count) {
                task.state = 'run'
                await runner.run_task(task)
                task.state = 'done'
              } else {
                task.state = 'warn'
              }
            } catch (err) {
              task.state = 'fail'
              errors.push(...err)
            }
          })
        )

        if (errors.length) {
          throw new NanoStagedError({
            type: 'output',
            stream: 'stderr',
            data: `\n${errors.join('\n\n')}\n`,
          })
        }
      } catch (err) {
        throw err
      }
    },

    async run_task(parent_task) {
      let skipped = false
      let errors = []

      for (const task of parent_task.tasks) {
        task.parent = parent_task

        try {
          if (skipped) {
            task.state = 'warn'
            continue
          }

          task.state = 'run'
          await task.run()
          task.state = 'done'
        } catch (error) {
          skipped = true
          task.title = c.red(task.title)
          task.state = 'fail'
          errors.push(`${c.red(task.pattern)} ${c.dim('>')} ${task.title}:\n` + error.trim())
        }
      }

      if (errors.length) {
        throw errors
      }
    },
  }

  return runner
}
