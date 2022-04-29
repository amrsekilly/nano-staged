import { get_config, valid_config } from './config.js'
import { generate_tasks } from './generate-tasks.js'
import { NanoStagedError } from './error.js'
import { create_logger } from './logger.js'
import { create_runner } from './runner.js'
import { create_git } from './git.js'
import { to_array } from './utils.js'

export default async function (options) {
  const opts = {
    stream: process.stderr,
    cwd: process.cwd(),
    allowEmpty: false,
    config: undefined,
    unstaged: false,
    diff: false,
    ...options,
  }

  const logger = create_logger(opts.stream)
  const git = create_git(opts.cwd)

  try {
    const git_paths = await git.paths()

    if (!git_paths.root) {
      throw new NanoStagedError({ type: 'failure', reason: 'no-git-repo' })
    }

    const config = await get_config(opts.cwd, opts.config)

    if (!config) {
      throw new NanoStagedError(
        typeof opts.config === 'string'
          ? { type: 'failure', reason: 'no-file-config', file: opts.config }
          : { type: 'failure', reason: 'no-config' }
      )
    }

    if (!valid_config(config)) {
      throw new NanoStagedError({ type: 'failure', reason: 'invalid-config' })
    }

    let files, type
    if (opts.unstaged) {
      files = await git.unstaged_files({ cwd: git_paths.root })
      type = 'unstaged'
    } else if (opts.diff && Array.isArray(opts.diff)) {
      files = await git.changed_files(opts.diff, { cwd: git_paths.root })
      type = 'diff'
    } else {
      files = await git.staged_files({ cwd: git_paths.root })
      type = 'staged'
    }

    if (!files.working.length) {
      logger.log({ type: 'info', detail: 'no-files', runner_type: type })
      return
    }

    const cmd_tasks = await generate_tasks({
      rootPath: git_paths.root,
      files: files.working,
      cwd: opts.cwd,
      config,
      type,
    })

    if (!cmd_tasks.some((task) => task.file_count > 0)) {
      logger.log({ type: 'info', detail: 'no-matching-files' })
      return
    }

    await create_runner({ ...opts, git_paths, cmd_tasks, files, type }).run()
  } catch (errors) {
    for (const e of to_array(errors)) {
      if (e instanceof NanoStagedError) {
        logger.log(e.event)
      } else {
        console.error(`Unexpected error: ${e.toString()}}`)
        console.error(e.stack)
      }
    }

    throw errors
  }
}
