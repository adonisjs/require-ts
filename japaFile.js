process.env.DEBUG = 'adonis:require-ts'
require('ts-node/register')

const { configure } = require('japa')
configure({
  files: ['test/**/*.spec.ts'],
})
