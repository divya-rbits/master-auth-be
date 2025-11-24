const argon2 = require('argon2');
const dbService = require('../src/services/database');
const supabase = require('../src/config/supabase');

/**
 * Database Seeding Script
 *
 * Seeds the database with:
 * 1. Master password hash in auth_config table
 * 2. Test application in applications table
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

async function seedMasterPassword() {
  console.log('📝 Seeding master password...');

  try {
    // Check if password already exists
    const existingHash = await dbService.getPasswordHash();

    if (existingHash) {
      console.log('⚠️  Master password already exists in database');
      console.log('   Skipping password seeding (use scripts/reset.js to reset)');
      return false;
    }

    // Hash the master password
    const passwordHash = await argon2.hash(DEV_MASTER_PASSWORD, ARGON2_CONFIG);

    // Store in database
    await dbService.updatePasswordHash(passwordHash);

    console.log('✅ Master password seeded successfully');
    console.log(`   Password: ${DEV_MASTER_PASSWORD}`);
    console.log('   ⚠️  CHANGE THIS IN PRODUCTION!');

    return true;
  } catch (error) {
    console.error('❌ Error seeding master password:', error.message);
    throw error;
  }
}

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

    // Insert test application
    const { data, error } = await supabase
      .from('applications')
      .insert({
        app_id: 'test-app',
        app_name: 'Test Application',
        app_secret: appSecretHash,
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
    // Verify master password
    const passwordHash = await dbService.getPasswordHash();
    if (passwordHash) {
      console.log('✅ Master password hash exists in database');
    } else {
      console.log('❌ Master password hash NOT found');
    }

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
    // Seed master password
    await seedMasterPassword();

    // Seed test application
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
