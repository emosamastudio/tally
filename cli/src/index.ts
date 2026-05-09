#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { lintCommand } from './commands/lint.js'
import { checkCommand } from './commands/check.js'
import { statusCommand } from './commands/status.js'

const program = new Command()
program.name('tally').description('Agent-native task management').version('0.1.0')

program.addCommand(initCommand())
program.addCommand(lintCommand())
program.addCommand(checkCommand())
program.addCommand(statusCommand())

program.parse()
