import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import { tmpdir } from 'os'
import fs from 'fs-extra'
import path from 'path'

import { FileSystemTest } from './file-system.js'
import { executor } from '../../../lib/executor.js'
import { create_git } from '../../../lib/git.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const nano_staged_bin = path.resolve(__dirname, '../../../lib/bin.js')

function create_temp() {
  const temp_dir = fs.realpathSync(tmpdir())
  const dirname = path.join(temp_dir, `nano-staged-${nanoid()}`)

  fs.ensureDirSync(dirname)
  return path.normalize(dirname)
}

export class WorkSpaceTest {
  async setup(has_git = true) {
    this.temp = create_temp()
    this.fs = new FileSystemTest({ cwd: this.temp })

    if (has_git) {
      this.git = create_git(this.temp)

      await this.git.exec(['init'])
      await this.git.exec(['config', 'user.name', '"nano-staged"'])
      await this.git.exec(['config', 'user.email', '"test@nanostaged.com"'])
      await this.git.exec(['config', 'merge.conflictstyle', 'merge'])
      await this.fs.append('README.md', '# Test\n')
      await this.git.exec(['add', 'README.md'])
      await this.fs.write(
        'package.json',
        JSON.stringify({ name: 'lint-staged-integration-test', type: 'module' })
      )
      await this.git.exec(['add', 'package.json'])
      await this.git.exec(['commit', '-m', '"initial commit"'])
    }
  }

  async commit(options, dir = this.temp) {
    let result

    const nano_staged_args = Array.isArray(options?.nano_staged) ? options.nano_staged : []
    const git_commit_args = Array.isArray(options?.git_commit)
      ? options.git_commit
      : ['-m', '"test"']

    try {
      result = await executor(nano_staged_bin, nano_staged_args, {
        cwd: dir,
      })

      await this.git.exec(['commit', ...git_commit_args], { cwd: dir, ...options })
    } catch (error) {
      throw error
    }

    return result
  }
}
