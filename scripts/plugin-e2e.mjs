import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'

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

if (run(dsh, ['--version'], project, env) !== '0.1.0-rc.6') {
  throw new Error('plugin e2e must run against DSH 0.1.0-rc.6')
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
assertClientRegistration(readFileSync(join(installedRoot, 'dist', 'client.js'), 'utf8'))
assertStrictHostArtifact(
  readFileSync(join(installedRoot, 'dist', 'index.js'), 'utf8'),
  readFileSync(join(installedRoot, 'dist', 'agent-tool.js'), 'utf8'),
)
const dumped = run(dsh, ['--profile', profile, '--dump-config'], project, env)
if (!dumped.includes('omdsh-plugin-lab') || !dumped.includes('@oh-my-dsh/plugin-lab')) {
  throw new Error(`dumped config does not contain Plugin Lab\n${dumped}`)
}
await bootAndInspect(dsh, project, profile, env)
run(dsh, ['plugin', '--profile', profile, 'remove', '@oh-my-dsh/plugin-lab'], project, env)
const removedManifest = JSON.parse(readFileSync(join(dshHome, 'profiles', profile, 'package.json'), 'utf8'))
if (removedManifest.dsh?.profile?.bundles?.includes('@oh-my-dsh/plugin-lab')) {
  throw new Error('dsh plugin remove left the bundle active')
}

console.log(`plugin e2e passed: ${basename(tarball)}`)

function assertClientRegistration(source) {
  let registration
  const browserWindow = {
    __ModuleLoader__: {
      load(value) { registration = value },
    },
  }
  Function('window', source)(browserWindow)
  if (registration?.id !== '@oh-my-dsh/plugin-lab' || typeof registration.factory !== 'function') {
    throw new Error('client artifact did not register with the rc.6 __ModuleLoader__ protocol')
  }
  const modules = {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
  }
  const client = registration.factory((id) => {
    if (!(id in modules)) throw new Error(`client artifact requested an unexpected platform module: ${id}`)
    return modules[id]
  })
  if (!Array.isArray(client.inject) || typeof client.apply !== 'function') {
    throw new Error('registered client artifact does not expose inject and apply')
  }
}

function assertStrictHostArtifact(indexSource, toolSource) {
  const source = `${indexSource}\n${toolSource}`
  if (!toolSource.includes('omdsh_analyze_plugin_experience')) {
    throw new Error('installed Host artifact omitted the Agent safe assessment tool')
  }
  for (const forbidden of ['uncaughtExceptionMonitor', 'participantId', 'crashes.ndjson', 'shareNote']) {
    if (source.includes(forbidden)) {
      throw new Error(`installed Host artifact retained forbidden v1 path: ${forbidden}`)
    }
  }
}

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

async function bootAndInspect(command, cwd, profileName, commandEnv) {
  const child = spawn(command, ['--profile', profileName, '--port', '0'], {
    cwd,
    env: commandEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`DSH Web did not publish a listening URL\n${output}`))
    }, 15_000)
    const capture = (chunk) => {
      output += chunk
      const matched = output.match(/dsh web: (http:\/\/[^\s]+)/u)
      if (matched?.[1] !== undefined) {
        clearTimeout(timer)
        resolveUrl(matched[1])
      }
    }
    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`DSH profile exited before listening (${code})\n${output}`))
    })
  })
  try {
    const home = await fetch(url)
    if (!home.ok) throw new Error(`DSH Web homepage returned HTTP ${home.status}`)
    const html = await home.text()
    const escapedId = '@oh-my-dsh/plugin-lab'.replaceAll('/', '\\/')
    const entry = html.match(new RegExp(`"id":"${escapedId}","url":"([^"]+)"`, 'u'))
    if (entry?.[1] === undefined) {
      throw new Error(`DSH Web boot manifest omitted @oh-my-dsh/plugin-lab\n${html.slice(0, 2_000)}`)
    }
    const client = await fetch(new URL(entry[1], url))
    if (!client.ok) throw new Error(`DSH Web client artifact returned HTTP ${client.status}`)
    const source = await client.text()
    if (!source.startsWith('window.__ModuleLoader__.load({ id: "@oh-my-dsh/plugin-lab"')) {
      throw new Error('served client artifact does not use the rc.6 module loader protocol')
    }
  } finally {
    await interrupt(child, output)
  }
}

async function interrupt(child, output) {
  if (child.exitCode !== null) return
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
