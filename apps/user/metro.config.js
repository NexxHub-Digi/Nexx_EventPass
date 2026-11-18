// Allow this standalone Expo app to bundle the shared design tokens in apps/shared.
// These apps install dependencies independently, rather than using npm workspaces.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../shared')];

module.exports = config;
