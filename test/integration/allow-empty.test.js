import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { pretty_js, ugly_js } from './fixtures/files.js'
import { WorkSpaceTest } from './utils/work-space.js'

const test = suite()

test.before.each(async (ctx) => {
  try {
    ctx.ws = new WorkSpaceTest()
    await ctx.ws.setup()
  } catch (e) {
    console.error('uvu before error', e)
    process.exit(1)
  }
})

test.after.each(async (ctx) => {
  try {
    await ctx.ws.fs.remove(ctx.ws.temp)
  } catch (e) {
    console.error('uvu after error', e)
    process.exit(1)
  }
})

test('fails when task reverts staged changes without `--allow-empty`, to prevent an empty git commit', async ({
  ws,
}) => {
  await ws.fs.write('.nano-staged.json', JSON.stringify({ '*.js': 'prettier --write' }))
  await ws.fs.write('test.js', pretty_js)

  await ws.git.exec(['add', '.'])
  await ws.git.exec(['commit', '-m', '"committed pretty file"'])

  await ws.fs.write('test.js', ugly_js)
  await ws.git.exec(['add', 'test.js'])

  try {
    await ws.commit()
  } catch (error) {
    console.log(error)
    assert.match(error, 'Prevented an empty git commit!')
  }

  assert.is(await ws.git.exec(['rev-list', '--count', 'HEAD']), '2')
  assert.is(await ws.git.exec(['log', '-1', '--pretty=%B']), 'committed pretty file')
  assert.is(await ws.fs.read('test.js'), ugly_js)
})

test('creates commit when task reverts staged changed and --allow-empty is used', async ({
  ws,
}) => {
  await ws.fs.write('.nano-staged.json', JSON.stringify({ '*.js': 'prettier --write' }))
  await ws.fs.write('test.js', pretty_js)

  await ws.git.exec(['add', '.'])
  await ws.git.exec(['commit', '-m', '"committed pretty file"'])

  await ws.fs.write('test.js', ugly_js)
  await ws.git.exec(['add', 'test.js'])

  const test = await ws.commit({
    nano_staged: ['--allow-empty'],
    git_commit: ['-m', '"test"', '--allow-empty'],
  })

  console.log(test)
  assert.is(await ws.git.exec(['rev-list', '--count', 'HEAD']), '3')
  assert.is(await ws.git.exec(['log', '-1', '--pretty=%B']), 'test')
  assert.is(await ws.fs.read('test.js'), pretty_js)
})

test.run()
