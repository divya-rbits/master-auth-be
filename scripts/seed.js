const argon2 = require('argon2');
const supabase = require('../src/config/supabase');

/**
 * Database Seeding Script
 *
 * Seeds the database with:
 * 1. Test application in applications table (includes per-application master password hash)
 *
 * Usage: node scripts/seed.js
 */

// Argon2 configuration - secure defaults
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4        // 4 threads
};

// Development credentials (CHANGE IN PRODUCTION!)
const DEV_MASTER_PASSWORD = 'MasterPassword123!';
const DEV_APP_SECRET = 'test-secret-123';

// Note: Master password is now set per-application in seedTestApplication()
// This function is kept for reference but is no longer used

async function seedTestApplication() {
  console.log('\n📝 Seeding test application...');

  try {
    // Check if test app already exists
    const { data: existing } = await supabase
      .from('applications')
      .select('*')
      .eq('app_id', 'test-app')
      .single();

    if (existing) {
      console.log('⚠️  Test application already exists in database');
      console.log('   Skipping application seeding');
      return false;
    }

    // Hash the application secret
    const appSecretHash = await argon2.hash(DEV_APP_SECRET, ARGON2_CONFIG);

    // Hash the master password for this application
    const masterPasswordHash = await argon2.hash(DEV_MASTER_PASSWORD, ARGON2_CONFIG);

    // Insert test application with its own master password
    const { error } = await supabase
      .from('applications')
      .insert({
        app_id: 'test-app',
        app_name: 'Test Application',
        app_secret: appSecretHash,
        master_password_hash: masterPasswordHash,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Test application seeded successfully');
    console.log(`   App ID: test-app`);
    console.log(`   App Secret: ${DEV_APP_SECRET}`);
    console.log(`   Master Password: ${DEV_MASTER_PASSWORD}`);
    console.log('   ⚠️  FOR DEVELOPMENT ONLY!');

    return true;
  } catch (error) {
    console.error('❌ Error seeding test application:', error.message);
    throw error;
  }
}

async function verifySeededData() {
  console.log('\n🔍 Verifying seeded data...');

  try {
    // Verify test application
    const { data: app, error } = await supabase
      .from('applications')
      .select('*')
      .eq('app_id', 'test-app')
      .single();

    if (app && !error) {
      console.log('✅ Test application exists in database');
      console.log(`   Name: ${app.app_name}`);
      console.log(`   Active: ${app.is_active}`);

      // Verify master password hash is set for this application
      if (app.master_password_hash) {
        console.log('✅ Master password hash is set for test application');
      } else {
        console.log('❌ Master password hash NOT set for test application');
      }
    } else {
      console.log('❌ Test application NOT found');
    }

    return true;
  } catch (error) {
    console.error('❌ Error verifying seeded data:', error.message);
    return false;
  }
}

async function main() {
  console.log('🌱 Starting database seeding...\n');
  console.log('⚠️  WARNING: Using development credentials');
  console.log('⚠️  DO NOT use these credentials in production!\n');

  try {
    // Seed test application (includes master password for this app)
    await seedTestApplication();

    // Verify all data
    await verifySeededData();

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Verify data in Supabase dashboard');
    console.log('   2. Update .env file with any custom values');
    console.log('   3. Test authentication with seeded credentials\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database seeding failed:', error.message);
    process.exit(1);
  }
}

// Run the seeding script
main();
