#!/usr/bin/env node
/* eslint-disable global-require */

if (!require('semver').gte(process.version, '6.4.0')) {
    console.log('Version of node.js doesn\'t meet minimum requirement.');
    console.log('Please ensure system has node.js version 6.4.0 or higher.');
    process.exit(1);
}

require('module-alias/register');
const commander = require('commander');

require('@src/commands/init').createCommand(commander);
require('@src/commands/deploy').createCommand(commander);
require('@src/commands/v2new').createCommand(commander);

commander
    .description('Command Line Interface for Alexa Skill Kit')
    .command('api', 'list of Alexa Skill Management API commands')
    .version(require('../package.json').version)
    .parse(process.argv);

const ALLOWED_ASK_ARGV_2 = ['api', 'init', 'deploy', 'new', 'help', '-v', '--version', '-h', '--help'];
if (process.argv[2] && ALLOWED_ASK_ARGV_2.indexOf(process.argv[2]) === -1) {
    console.log('Command not recognized. Please run "askx" to check the user instructions.');
}
