import { create_git_workflow } from './git-workflow.js'
import { create_renderer } from './renderer.js'

export function create_runner({
  allowEmpty,
  cmd_runner,
  cmd_tasks,
  git_paths,
  stream,
  files,
  type,
}) {
  const renderer = create_renderer(stream, { isTTY: !process.env.CI })
  const git_workflow = create_git_workflow({
    allowEmpty,
    rootPath: git_paths.root,
    dotPath: git_paths.dot,
  })
  const changes = [...files.changed, ...files.deleted]

  const runner = {
    async run() {
      let enabled = false
      let revert = false
      let clear = true
      let errors = []
      let tasks = []

      tasks.push({
        title: `Preparing nano-staged`,
        run: async () => {
          try {
            await git_workflow.backup_original_state()
          } catch (e) {
            enabled = true
            throw e
          }
        },
      })

      tasks.push({
        title: `Backing up unstaged changes for staged files`,
        run: async () => {
          try {
            await git_workflow.backup_unstaged_files(changes)
          } catch (e) {
            revert = true
            throw e
          }
        },
        skipped: () => enabled || type === 'unstaged' || type === 'diff' || changes.length === 0,
      })

      tasks.push({
        title: `Running tasks for ${type} files`,
        run: async (task) => {
          task.tasks = cmd_tasks

          try {
            await cmd_runner.run(task)
          } catch (e) {
            revert = true
            throw e
          }
        },
        skipped: () => enabled || revert,
      })

      tasks.push({
        title: `Applying modifications from tasks`,
        run: async () => {
          try {
            await git_workflow.apply_modifications(files.working)
          } catch (e) {
            revert = true
            throw e
          }
        },
        skipped: () => enabled || revert || type === 'unstaged' || type === 'diff',
      })

      tasks.push({
        title: `Restoring unstaged changes for staged files`,
        run: async () => {
          try {
            await git_workflow.restore_unstaged_files(changes)
          } catch (e) {
            throw e
          }
        },
        skipped: () =>
          enabled || revert || type === 'unstaged' || type === 'diff' || changes.length === 0,
      })

      tasks.push({
        title: `Restoring to original state because of errors`,
        run: async () => {
          try {
            await git_workflow.restore_original_state()
          } catch (e) {
            clear = false
            throw e
          }
        },
        skipped: () => enabled || !revert,
      })

      tasks.push({
        title: `Cleaning up temporary to patch files`,
        run: async () => {
          try {
            await git_workflow.clean_up()
          } catch (e) {
            throw e
          }
        },
        skipped: () => enabled || !clear,
      })

      for (const task of tasks) {
        if (task.skipped ? !task.skipped() : true) {
          renderer.start(task)

          try {
            task.state = 'run'
            await task.run(task)
            task.state = 'done'
          } catch (e) {
            task.state = 'fail'
            errors.push(e)
          }
        }
      }

      renderer.stop()

      if (errors.length > 0) {
        throw errors.length === 1 ? errors[0] : new AggregateError(errors)
      }
    },
  }

  return runner
}
