#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  try {
    // Try to parse the line as JSON
    const log = JSON.parse(line);
    
    // Format timestamp if it exists
    if (log.timestamp) {
      const date = new Date(log.timestamp);
      log.timestamp = date.toLocaleString();
    }

    // Format the log with colors
    console.log('\n' + '='.repeat(80));
    console.log('\x1b[36m%s\x1b[0m', `[${log.level.toUpperCase()}] ${log.timestamp || ''}`);
    console.log('\x1b[33m%s\x1b[0m', log.message);
    
    // Print additional fields
    Object.entries(log).forEach(([key, value]) => {
      if (!['level', 'message', 'timestamp'].includes(key)) {
        console.log('\x1b[32m%s\x1b[0m', `${key}:`, value);
      }
    });
    console.log('='.repeat(80) + '\n');
  } catch (e) {
    // If not JSON, print the line as is
    console.log(line);
  }
}); 