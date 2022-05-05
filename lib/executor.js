import { join, dirname, delimiter } from 'path'
import { spawn } from 'child_process'

const PATH_ENV_SUFFIX = (() => {
  const path = process.env.PATH ?? ''
  const entries = path.split(delimiter)
  const nodeModulesBinSuffix = join('node_modules', '.bin')
  const endOfNodeModuleBins = entries.findIndex((entry) => !entry.endsWith(nodeModulesBinSuffix))
  return entries.slice(endOfNodeModuleBins).join(delimiter)
})()

function path_env_var(cwd) {
  let entries = []
  let cur = cwd

  while (true) {
    entries.push(join(cur, 'node_modules', '.bin'))

    const parent = dirname(cur)
    if (parent === cur) break

    cur = parent
  }

  entries.push(PATH_ENV_SUFFIX)
  return entries.join(delimiter)
}

export async function executor(command, args = [], opts = {}) {
  const child = spawn([command, ...args].join(' '), {
    ...opts,
    shell: true,
    env: {
      ...process.env,
      ...opts.env,
      PATH: path_env_var(opts.cwd || process.cwd()),
    },
  })

  let replay = ''

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      replay += data
    })
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      replay += data
    })
  }

  return new Promise((resolve, reject) => {
    child.on('error', () => {
      reject(replay)
    })

    child.on('close', (status, signal) => {
      if (signal !== null) {
        reject(replay)
      } else if (status !== 0) {
        reject(replay)
      } else {
        resolve(replay)
      }
    })
  })
}
