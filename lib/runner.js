import c from 'picocolors'

import { create_git_workflow } from './git-workflow.js'
import { NanoStagedError } from './error.js'
import { create_task } from './task.js'

export function create_runner({ allowEmpty, cmd_tasks, git_paths, stream, files, type }) {
  const git_workflow = create_git_workflow({
    allowEmpty,
    rootPath: git_paths.root,
    dotPath: git_paths.dot,
  })
  const changes = [...files.changed, ...files.deleted]
  const task = create_task([], { stream, isTTY: !process.env.CI })

  const runner = {
    async run() {
      let skip_all = false
      let revert = false
      let clear = true
      let errors = []

      await task('Preparing nano-staged', async ({ update }) => {
        try {
          await git_workflow.backup_original_state()
        } catch (e) {
          skip_all = true
          errors.push(e)
          update({ state: 'error' })
        }
      })

      if (!skip_all && type !== 'unstaged' && type !== 'diff' && changes.length > 0) {
        await task('Backing up unstaged changes for staged files', async ({ update }) => {
          try {
            await git_workflow.backup_unstaged_files(changes)
          } catch (e) {
            revert = true
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!skip_all && !revert) {
        await task(`Running tasks for ${type} files`, async ({ task, update }) => {
          try {
            let errors = []

            await Promise.all(
              cmd_tasks.map((cmd_task) =>
                task(cmd_task.title, async ({ task, update }) => {
                  if (cmd_task.file_count === 0) {
                    update({ state: 'warning' })
                  } else {
                    try {
                      let errors = []
                      let skipped = false

                      await task.group((task) =>
                        cmd_task.tasks.map((sub_task) =>
                          task(sub_task.title, async ({ update }) => {
                            try {
                              if (skipped) {
                                update({
                                  state: 'warning',
                                })
                              } else {
                                await sub_task.run()
                              }
                            } catch (e) {
                              skipped = true
                              update({
                                title: c.red(sub_task.title),
                                state: 'error',
                              })

                              errors.push(
                                `${c.red(sub_task.pattern)} ${c.dim('>')} ${
                                  sub_task.title
                                }:\n${e.trim()}`
                              )
                            }
                          })
                        )
                      )

                      if (errors.length > 0) {
                        throw errors
                      }
                    } catch (e) {
                      update({ state: 'error' })
                      errors.push(...e)
                    }
                  }
                })
              )
            )

            if (errors.length) {
              throw new NanoStagedError({
                type: 'output',
                stream: 'stderr',
                data: `\n${errors.join('\n\n')}\n`,
              })
            }
          } catch (e) {
            revert = true
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!skip_all && !revert && type !== 'unstaged' && type !== 'diff') {
        await task(`Applying modifications from tasks`, async ({ update }) => {
          try {
            await git_workflow.apply_modifications(files.working)
          } catch (e) {
            revert = true
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!skip_all && !revert && type !== 'unstaged' && type !== 'diff' && changes.length > 0) {
        await task(`Restoring unstaged changes for staged files`, async ({ update }) => {
          try {
            await git_workflow.restore_unstaged_files(changes)
          } catch (e) {
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!skip_all && revert) {
        await task(`Restoring to original state because of errors`, async ({ update }) => {
          try {
            await git_workflow.restore_original_state()
          } catch (e) {
            clear = false
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!skip_all && clear) {
        await task('Cleaning up temporary to patch files', async ({ update }) => {
          try {
            await git_workflow.clean_up()
          } catch (e) {
            errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      task.stop()

      if (errors.length > 0) {
        throw errors
      }
    },
  }

  return runner
}
