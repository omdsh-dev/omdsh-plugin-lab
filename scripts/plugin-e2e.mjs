import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'

const project = resolve(import.meta.dirname, '..')
const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-e2e-'))
const pack = run('pnpm', ['pack', '--pack-destination', root], project)
const tarballLine = pack.trim().split('\n').at(-1)
if (tarballLine === undefined) throw new Error('pnpm pack did not return a tarball path')
const tarball = resolve(project, tarballLine)
const dshHome = join(root, 'dsh-home')
// The Web profile exercises both the Host bundle and package.json dsh.client
// discovery; a headless custom profile would only prove the Host half.
const profile = 'web'
const dsh = join(project, 'node_modules', '.bin', 'dsh')
const env = {
  ...process.env,
  DSH_HOME: dshHome,
  DSH_TELEMETRY_DISABLED: '1',
  NO_COLOR: '1',
}

run(dsh, ['plugin', '--profile', profile, 'add', tarball], project, env)
const profileManifest = JSON.parse(readFileSync(join(dshHome, 'profiles', profile, 'package.json'), 'utf8'))
if (profileManifest.dependencies?.['@oh-my-dsh/plugin-lab'] === undefined) {
  throw new Error('dsh plugin add did not install @oh-my-dsh/plugin-lab')
}
if (!profileManifest.dsh?.profile?.bundles?.includes('@oh-my-dsh/plugin-lab')) {
  throw new Error('dsh plugin add did not activate the bundle')
}
const installedRoot = join(dshHome, 'profiles', profile, 'node_modules', '@oh-my-dsh', 'plugin-lab')
const installedManifest = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'))
if (installedManifest.exports?.['./client']?.default !== './dist/client.js') {
  throw new Error('installed package does not expose the Web client plugin')
}
if (installedManifest.dsh?.client?.platform !== 'web') {
  throw new Error('installed package does not declare a Web dsh.client')
}
const dumped = run(dsh, ['--profile', profile, '--dump-config'], project, env)
if (!dumped.includes('omdsh-plugin-lab') || !dumped.includes('@oh-my-dsh/plugin-lab')) {
  throw new Error(`dumped config does not contain Plugin Lab\n${dumped}`)
}
await bootAndInterrupt(dsh, project, profile, env)
run(dsh, ['plugin', '--profile', profile, 'remove', '@oh-my-dsh/plugin-lab'], project, env)
const removedManifest = JSON.parse(readFileSync(join(dshHome, 'profiles', profile, 'package.json'), 'utf8'))
if (removedManifest.dsh?.profile?.bundles?.includes('@oh-my-dsh/plugin-lab')) {
  throw new Error('dsh plugin remove left the bundle active')
}

console.log(`plugin e2e passed: ${basename(tarball)}`)

function run(command, args, cwd, commandEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env: commandEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout.trim()
}

async function bootAndInterrupt(command, cwd, profileName, commandEnv) {
  const child = spawn(command, ['--profile', profileName], {
    cwd,
    env: commandEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  await new Promise(resolve => setTimeout(resolve, 2_000))
  if (child.exitCode !== null) {
    throw new Error(`DSH profile exited before the smoke window (${child.exitCode})\n${output}`)
  }
  child.kill('SIGINT')
  const exit = await Promise.race([
    new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('DSH profile did not stop after SIGINT')), 10_000)),
  ]).catch(error => {
    child.kill('SIGKILL')
    throw error
  })
  if (exit.code !== 130 && exit.signal !== 'SIGINT') {
    throw new Error(`DSH profile stopped unexpectedly (${JSON.stringify(exit)})\n${output}`)
  }
}
