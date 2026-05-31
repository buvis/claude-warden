const fs = require('fs');
const pkg = require('../package.json');

const pluginManifest = '.claude-plugin/plugin.json';
const marketplaceManifest = '.claude-plugin/marketplace.json';

// This plugin's own name, used to target the right marketplace entry so a
// release never overwrites the versions of OTHER plugins in the list.
const selfName = JSON.parse(fs.readFileSync(pluginManifest, 'utf-8')).name;

// 1. This plugin's own manifest tracks pkg.version directly.
const plugin = JSON.parse(fs.readFileSync(pluginManifest, 'utf-8'));
plugin.version = pkg.version;
fs.writeFileSync(pluginManifest, JSON.stringify(plugin, null, 2) + '\n');

// 2. In the marketplace, touch ONLY this plugin's entry. Never loop-stamp every
//    plugin: doing so is what once clobbered the whole list to one version.
const marketplace = JSON.parse(fs.readFileSync(marketplaceManifest, 'utf-8'));
const entry = (marketplace.plugins || []).find((p) => p.name === selfName);
if (!entry) {
  console.error(`No marketplace entry named "${selfName}"; nothing synced.`);
  process.exit(1);
}
entry.version = pkg.version;
fs.writeFileSync(marketplaceManifest, JSON.stringify(marketplace, null, 2) + '\n');

console.log(`Synced ${selfName} version ${pkg.version} to ${pluginManifest} and ${marketplaceManifest}`);
