const fs = require('fs');
const pkg = require('../package.json');

const targets = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
];

for (const file of targets) {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (data.version !== undefined) {
    data.version = pkg.version;
  }
  if (Array.isArray(data.plugins)) {
    for (const plugin of data.plugins) {
      if (plugin.version !== undefined) {
        plugin.version = pkg.version;
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

console.log(`Synced version ${pkg.version} to ${targets.join(', ')}`);
