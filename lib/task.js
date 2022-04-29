import { create_renderer } from './renderer.js'

function create_task_api(root) {
  return {
    task: create_task(root.children),
    update({ title, state }) {
      title && (root.title = title)
      state && (root.state = state)
    },
  }
}

let renderer
function register_task(list, title, fn, opts) {
  if (!renderer) {
    renderer = create_renderer(list, opts)
  }

  const index = list.push({
    title: title,
    state: 'pending',
    children: [],
    skip: false,
  })

  const task_state = list[index - 1]

  return {
    async run() {
      const task_api = create_task_api(task_state)
      task_state.state = 'loading'

      try {
        await fn(task_api)
      } catch (error) {
        throw error
      }

      if (task_state.state === 'loading') {
        task_state.state = 'success'
      }
    },
  }
}

export function create_task(list, opts = {}) {
  const task = async (title, fn) => {
    const state = register_task(list, title, fn, opts)
    const result = await state.run()

    return Object.assign(state, { result })
  }

  task.group = async (create_tasks) => {
    const tasks = create_tasks((title, fn) => register_task(list, title, fn, opts))

    for (const task of tasks) {
      await task.run()
    }
  }

  task.stop = () => {
    renderer.stop()
  }

  return task
}
