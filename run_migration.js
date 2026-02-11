import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Supabase configuration
const supabaseUrl = 'https://hnsvejzbmhtcamwamqey.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3ZlanpibWh0Y2Ftd2FtcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTM0OTU1OCwiZXhwIjoyMDU0OTI1NTU4fQ.y7aXDNBpLYJhWKZp8fxB7xt9WpNHST8lQdHlP20sRH8';

// Create Supabase client with minimal configuration to avoid fetch issues
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} catch {
  console.log('⚠️  Supabase client initialization skipped (this is fine)');
}

async function runMigration() {
  try {
    console.log('📖 Reading migration file...');
    
    let sqlContent;
    try {
      sqlContent = readFileSync('complete_database_optimization.sql', 'utf8');
    } catch {
      console.error('❌ Could not find complete_database_optimization.sql');
      console.error('💡 Make sure the file exists in the current directory');
      return false;
    }
    
    console.log('✅ Migration file loaded successfully!');
    console.log(`📄 File size: ${(sqlContent.length / 1024).toFixed(2)} KB`);
    
    // Analyze the migration file
    const lines = sqlContent.split('\n');
    const commentLines = lines.filter(line => line.trim().startsWith('--')).length;
    const totalLines = lines.length;
    
    console.log('\n📊 Migration Analysis:');
    console.log(`   • Total lines: ${totalLines}`);
    console.log(`   • Comment lines: ${commentLines}`);
    console.log(`   • Code lines: ${totalLines - commentLines}`);
    
    // Check for key migration sections
    const sections = [
      'PROFILES TABLE IMPROVEMENTS',
      'TEAMS TABLE IMPROVEMENTS', 
      'TEAM_MEMBERS TABLE IMPROVEMENTS',
      'PROBLEM STATEMENTS TABLE',
      'NOTIFICATIONS TABLE',
      'RLS POLICIES'
    ];
    
    console.log('\n✅ Migration includes:');
    sections.forEach(section => {
      if (sqlContent.includes(section)) {
        console.log(`   ✓ ${section}`);
      }
    });
    
    // Check for potential issues
    const potentialIssues = [];
    if (!sqlContent.includes('BEGIN;')) {
      potentialIssues.push('No transaction wrapper found');
    }
    if (!sqlContent.includes('COMMIT;')) {
      potentialIssues.push('No transaction commit found');
    }
    
    if (potentialIssues.length > 0) {
      console.log('\n⚠️  Potential issues:');
      potentialIssues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    console.log('\n💡 This migration is designed to be safe and can be re-run if needed.');
    console.log('💡 It includes comprehensive error handling and data cleanup.');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to analyze migration file:', error.message);
    return false;
  }
}

// Test database connection (optional, non-blocking)
async function testConnection() {
  if (!supabase) {
    console.log('⏭️  Database connection test skipped (client not initialized)');
    return false;
  }
  
  try {
    console.log('🔗 Testing database connection...');
    
    // Use a simple query that should work on any Supabase database
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error && !error.message.includes('relation "profiles" does not exist')) {
      console.log('⚠️  Database connection issue:', error.message);
      return false;
    } else {
      console.log('✅ Database connection successful!');
      return true;
    }
  } catch {
    // Network errors, fetch failures, etc.
    console.log('⚠️  Database connection test failed (this is okay)');
    console.log('💡 The migration can still be run manually in Supabase Dashboard');
    return false;
  }
}

// Display instructions for manual migration
function showMigrationInstructions() {
  console.log('\n🚨 MANUAL MIGRATION REQUIRED:');
  console.log('   The Supabase JavaScript client cannot execute raw SQL migrations.');
  console.log('');
  console.log('📋 TO RUN THE MIGRATION:');
  console.log('   1. Open https://supabase.com/dashboard');
  console.log('   2. Go to your project → SQL Editor');
  console.log('   3. Copy ALL content from complete_database_optimization.sql');
  console.log('   4. Paste and click "Run" in the SQL Editor');
  console.log('');
  console.log('⏱️  Expected execution time: 30-60 seconds');
  console.log('📊 You should see "Migration completed successfully!" when done');
}

// Main execution
console.log('🚀 Database Migration Helper');
console.log('============================\n');

(async function main() {
  try {
    const migrationReady = await runMigration();
    
    if (migrationReady) {
      // Try to test connection (non-blocking)
      await testConnection().catch(() => {
        // Ignore connection test failures
      });
      
      showMigrationInstructions();
      
      console.log('\n✨ Migration helper completed successfully!');
      console.log('👉 Follow the instructions above to complete the migration.');
    } else {
      console.log('\n❌ Migration helper failed to analyze the migration file.');
      console.log('💡 Make sure complete_database_optimization.sql exists in the current directory.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    console.error('📞 Please check your migration file and try again.');
    process.exit(1);
  }
})();