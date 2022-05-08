import fs from 'fs-extra'
import path from 'path'

export class FileSystemTest {
  constructor({ cwd }) {
    this.cwd = cwd
  }

  async append(file_name, content, dir = this.cwd) {
    const file_path = path.isAbsolute(file_name) ? file_name : path.join(dir, file_name)
    const file_dir = path.parse(file_path).dir

    await fs.ensureDir(file_dir)
    await fs.appendFile(file_path, content)
  }

  async write(file_name, content, dir = this.cwd) {
    const file_path = path.isAbsolute(file_name) ? file_name : path.join(dir, file_name)
    const file_dir = path.parse(file_path).dir

    await fs.ensureDir(file_dir)
    await fs.writeFile(file_path, content)
  }

  async read(file_name, dir = this.cwd) {
    const file_path = path.isAbsolute(file_name) ? file_name : path.join(dir, file_name)
    return await fs.readFile(file_path, { encoding: 'utf-8' })
  }

  async remove(file_name, dir = this.cwd) {
    const file_path = path.isAbsolute(file_name) ? file_name : path.join(dir, file_name)
    await fs.remove(file_path)
  }

  async copy(file_name, new_file_name) {
    await fs.copy(file_name, new_file_name)
  }
}
