#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'scripts'
];

// Console methods to remove/replace
const CONSOLE_METHODS = [
  'console.log',
  'console.debug',
  'console.info',
  'console.trace'
];

// Console methods to keep (errors and warnings)
const KEEP_CONSOLE_METHODS = [
  'console.error',
  'console.warn'
];

function shouldIgnoreFile(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isTargetFile(filePath) {
  return TARGET_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    
    if (shouldIgnoreFile(fullPath)) {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (isTargetFile(fullPath)) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function cleanConsoleStatements(content) {
  let cleanedContent = content;
  let removedCount = 0;

  // Remove standalone console statements
  CONSOLE_METHODS.forEach(method => {
    const patterns = [
      // Simple console.log('message')
      new RegExp(`^\\s*${method.replace('.', '\\.')}\\([^)]*\\);?\\s*$`, 'gm'),
      // Console with template literals
      new RegExp(`^\\s*${method.replace('.', '\\.')}\\(\`[^\`]*\`[^)]*\\);?\\s*$`, 'gm'),
      // Multi-line console statements
      new RegExp(`^\\s*${method.replace('.', '\\.')}\\([\\s\\S]*?\\);?\\s*$`, 'gm')
    ];

    patterns.forEach(pattern => {
      const matches = cleanedContent.match(pattern);
      if (matches) {
        removedCount += matches.length;
        cleanedContent = cleanedContent.replace(pattern, '');
      }
    });
  });

  // Clean up multiple empty lines
  cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

  return { content: cleanedContent, removedCount };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: cleanedContent, removedCount } = cleanConsoleStatements(content);

    if (removedCount > 0) {
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      console.log(`✅ ${filePath}: Removed ${removedCount} console statement(s)`);
      return removedCount;
    }

    return 0;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

function main() {
  const rootDir = process.argv[2] || process.cwd();
  
  console.log('🧹 Starting console cleanup...');
  console.log(`📁 Scanning directory: ${rootDir}`);
  console.log(`🎯 Target extensions: ${TARGET_EXTENSIONS.join(', ')}`);
  console.log(`🚫 Ignoring: ${IGNORE_PATTERNS.join(', ')}`);
  console.log('');

  const files = getAllFiles(rootDir);
  let totalRemoved = 0;
  let filesProcessed = 0;

  files.forEach(file => {
    const removed = processFile(file);
    totalRemoved += removed;
    if (removed > 0) {
      filesProcessed++;
    }
  });

  console.log('');
  console.log('📊 Cleanup Summary:');
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files modified: ${filesProcessed}`);
  console.log(`   Console statements removed: ${totalRemoved}`);
  console.log('');
  
  if (totalRemoved > 0) {
    console.log('✨ Console cleanup completed successfully!');
    console.log('⚠️  Note: console.error and console.warn statements were preserved.');
  } else {
    console.log('✨ No console statements found to remove.');
  }
}

main();