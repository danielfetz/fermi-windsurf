const fs = require('fs');
const path = require('path');

// Configuration file path
const configPath = path.join(__dirname, 'js', 'config.js');

// Read the config file
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace placeholders with environment variables
configContent = configContent.replace('%SUPABASE_URL%', process.env.SUPABASE_URL);
configContent = configContent.replace('%SUPABASE_KEY%', process.env.SUPABASE_KEY);

// Write the updated content back to the file
fs.writeFileSync(configPath, configContent);

console.log('Environment variables injected into config.js');
