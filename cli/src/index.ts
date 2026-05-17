#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { lintCommand } from './commands/lint.js'
import { checkCommand } from './commands/check.js'
import { statusCommand } from './commands/status.js'
import { taskCommand } from './commands/task.js'
import { roundCommand } from './commands/round.js'
import { exportCommand } from './commands/export.js'
import { syncCommand } from './commands/sync.js'
import { graphCommand } from './commands/graph.js'
import { upgradeCommand } from './commands/upgrade.js'
import { dashboardCommand } from './commands/dashboard.js'
import { migrateCommand } from './commands/migrate.js'
import { featureCommand } from './commands/feature.js'
import { moduleCommand } from './commands/module.js'
import { stageCommand } from './commands/stage.js'

const program = new Command()
program.name('tally').description('Agent-native task management').version('0.1.0')

program.addCommand(initCommand())
program.addCommand(lintCommand())
program.addCommand(checkCommand())
program.addCommand(statusCommand())
program.addCommand(taskCommand())
program.addCommand(featureCommand())
program.addCommand(moduleCommand())
program.addCommand(stageCommand())
program.addCommand(roundCommand())
program.addCommand(exportCommand())
program.addCommand(syncCommand())
program.addCommand(graphCommand())
program.addCommand(upgradeCommand())
program.addCommand(migrateCommand())
program.addCommand(dashboardCommand())

program.parse()
