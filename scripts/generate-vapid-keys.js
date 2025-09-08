import webPush from 'web-push';
import fs from 'fs';
import path from 'path';

// Generate VAPID keys
const vapidKeys = webPush.generateVAPIDKeys();

console.log('Generated VAPID Keys:');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

// Create .env.example file with the keys
const envExample = `# VAPID Keys for Web Push Notifications
VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:your-email@example.com

# Supabase Configuration (if not already set)
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
`;

// Check if .env.example already exists and create/update it
const envExamplePath = path.join(process.cwd(), '.env.example');
fs.writeFileSync(envExamplePath, envExample);

// Check if .env file exists and append keys if it doesn't contain them
const envPath = path.join(process.cwd(), '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Only add VAPID keys if they don't already exist
if (!envContent.includes('VITE_VAPID_PUBLIC_KEY')) {
  const vapidEnvVars = `
# VAPID Keys for Web Push Notifications
VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:your-email@example.com
`;
  
  fs.appendFileSync(envPath, vapidEnvVars);
  console.log('\n✅ VAPID keys added to .env file');
} else {
  console.log('\n⚠️  VAPID keys already exist in .env file');
}

console.log('\n✅ Environment configuration completed!');
console.log('📝 Please update VAPID_SUBJECT in your .env file with your actual email address');
console.log('📁 Created/updated .env.example with the new keys');