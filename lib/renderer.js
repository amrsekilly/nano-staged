import readline from 'readline'
import c from 'picocolors'

const spinnerMap = new WeakMap()
const spinnerFrames = ['-', '\\', '|', '/']

function get_spinner() {
  let index = 0

  return () => {
    index = ++index % spinnerFrames.length
    return spinnerFrames[index]
  }
}

function get_lines(str = '', width = 80) {
  return str
    .replace(/\u001b[^m]*?m/g, '')
    .split('\n')
    .reduce((col, l) => (col += Math.max(1, Math.ceil(l.length / width))), 0)
}

function get_state_symbol(task) {
  if (task.state === 'success') {
    return c.green('√')
  } else if (task.state === 'error') {
    return c.red('×')
  } else if (task.state === 'warning') {
    return c.yellow('↓')
  } else if (task.state === 'loading') {
    let spinner = spinnerMap.get(task)

    if (!spinner) {
      spinner = get_spinner()
      spinnerMap.set(task, spinner)
    }

    return c.yellow(spinner())
  } else {
    return c.gray('*')
  }
}

function get_titles(task) {
  const titles = [task.title]
  let current = task

  while (current.parent) {
    current = current.parent
    if (current.title) titles.unshift(current.title)
  }

  return titles
}

function render_tree(tasks, level = 0) {
  let output = []

  for (const task of tasks) {
    const title = task.title
    const prefix = `${get_state_symbol(task)} `

    output.push('  '.repeat(level) + prefix + title)

    if (task.children && task.children.length > 0) {
      if (task.state !== 'success') {
        output = output.concat(render_tree(task.children, level + 1))
      }
    }
  }

  return output.join('\n')
}

function render_ci(tasks) {
  let output = ''

  for (const task of tasks) {
    if (task.state && task.state !== 'end' && task.state !== 'loading' && !task.tasks) {
      const title = get_titles(task).join(c.yellow(' ≫ '))
      const prefix = `${get_state_symbol(task)} `

      output += prefix + title + '\n'
      task.state = 'end'
    }

    if (task.tasks && task.tasks.length > 0) {
      output += render_ci(task.tasks)
    }
  }

  return output
}

export function create_renderer(tasks, { stream = process.stderr, isTTY = true } = {}) {
  let lines = 0
  let timer

  const api = {
    clear() {
      for (let i = 0; i < lines; i++) {
        i > 0 && readline.moveCursor(stream, 0, -1)
        readline.cursorTo(stream, 0)
        readline.clearLine(stream, 0)
      }
      lines = 0
    },

    write(str, clear = false) {
      if (clear) {
        this.clear()
      }

      stream.write(str)
    },

    render() {
      const output = isTTY ? render_tree(tasks) : render_ci(tasks)

      if (isTTY) {
        this.write(output, true)
        lines = get_lines(output, stream.columns)
      } else {
        this.write(output)
      }

      return this
    },

    spin() {
      return this.render()
    },

    loop() {
      timer = setTimeout(() => this.loop(), 130)
      return this.spin()
    },

    start() {
      if (timer) return this
      if (isTTY) stream.write(`\x1b[?25l`)

      return this.loop()
    },

    stop() {
      if (timer) {
        timer = clearTimeout(timer)

        if (isTTY) {
          this.write(`${render_tree(tasks)}\n`, true)
          this.write(`\x1b[?25h`)
        } else {
          this.write(render_ci(tasks))
        }
      }

      return this
    },
  }

  return api.start()
}
