#!/usr/bin/env node

import fs from 'fs';
import { loadEnv } from 'vite';

console.log('🔍 Environment Variables Debug Script');
console.log('=====================================');

// Check if .env file exists
const envExists = fs.existsSync('.env');
console.log(`📁 .env file exists: ${envExists ? '✅' : '❌'}`);

if (envExists) {
  const envContent = fs.readFileSync('.env', 'utf8');
  console.log('\n📄 .env file content:');
  console.log('---------------------');
  
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      console.log(`${key}: ${value.substring(0, 20)}...`);
    }
  });
}

// Load environment using Vite's method
console.log('\n🔧 Vite Environment Loading:');
console.log('----------------------------');

try {
  const env = loadEnv('development', '.', '');
  
  const requiredVars = [
    'REACT_APP_SUPABASE_URL',
    'REACT_APP_SUPABASE_ANON_KEY', 
    'REACT_APP_STREAM_API_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_STREAM_API_KEY'
  ];

  requiredVars.forEach(varName => {
    const value = env[varName];
    console.log(`${varName}: ${value ? '✅ Found' : '❌ Missing'}`);
    if (value) {
      console.log(`  Value: ${value.substring(0, 30)}...`);
    }
  });

} catch (error) {
  console.error('❌ Error loading environment:', error.message);
}

console.log('\n💡 Troubleshooting Tips:');
console.log('------------------------');
console.log('1. Make sure .env file is in the project root');
console.log('2. Restart your development server after changes');
console.log('3. Check for extra spaces or quotes in .env file');
console.log('4. Ensure variables start with REACT_APP_ or VITE_');
console.log('5. Current working directory:', process.cwd());

// Process environment check
console.log('\n🌍 Process Environment:');
console.log('----------------------');
const processVars = Object.keys(process.env).filter(key => 
  key.includes('REACT_APP') || key.includes('VITE') || key.includes('SUPABASE') || key.includes('STREAM')
);

if (processVars.length > 0) {
  processVars.forEach(key => {
    console.log(`${key}: ${process.env[key] ? '✅ Found' : '❌ Missing'}`);
  });
} else {
  console.log('❌ No relevant environment variables found in process.env');
}