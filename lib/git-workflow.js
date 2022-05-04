import fs from 'fs'
import { resolve } from 'path'

import { NanoStagedError } from './error.js'
import { create_git } from './git.js'

export function create_git_workflow({ allowEmpty = false, dotPath = '', rootPath = '' } = {}) {
  const git = create_git(rootPath)
  const patch = {
    unstaged: resolve(dotPath, './nano-staged_partial.patch'),
    original: resolve(dotPath, './nano-staged.patch'),
  }

  const workflow = {
    has_patch(path = '') {
      let has = false

      if (path) {
        try {
          let buffer = fs.readFileSync(path)
          has = buffer && buffer.toString()
        } catch {
          has = false
        }
      }

      return Boolean(has)
    },

    async backup_original_state() {
      try {
        await git.diff(patch.original)
      } catch (e) {
        throw e
      }
    },

    async backup_unstaged_files(files = []) {
      if (files.length) {
        try {
          await git.diff(patch.unstaged, files)
          await git.checkout(files)
        } catch (e) {
          throw e
        }
      }
    },

    async apply_modifications(files = []) {
      if (files.length) {
        try {
          if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
            throw new NanoStagedError({ type: 'failure', reason: 'empty-git-commit' })
          }

          await git.add(files)
        } catch (e) {
          throw e
        }
      }
    },

    async restore_unstaged_files(files = []) {
      if (files.length) {
        try {
          await git.apply(patch.unstaged)
        } catch {
          try {
            await git.apply(patch.unstaged, true)
          } catch {
            throw new NanoStagedError({ type: 'failure', reason: 'merge-conflict' })
          }
        }
      }
    },

    async restore_original_state() {
      try {
        await git.checkout('.')

        if (workflow.has_patch(patch.original)) {
          await git.apply(patch.original)
        }
      } catch (e) {
        throw e
      }
    },

    async clean_up() {
      try {
        if (workflow.has_patch(patch.original)) {
          fs.unlinkSync(patch.original)
        }

        if (workflow.has_patch(patch.unstaged)) {
          fs.unlinkSync(patch.unstaged)
        }
      } catch (e) {
        throw e
      }
    },
  }

  return workflow
}
