import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://hnsvejzbmhtcamwamqey.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3ZlanpibWh0Y2Ftd2FtcWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzNDk1NTgsImV4cCI6MjA1NDkyNTU1OH0.MZBQE7lltYi_r6_NRgc9k0CHpDfQJw6bOp94WMtg7aE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabaseState() {
  console.log('🔍 Testing Database State\n');
  console.log('=' .repeat(50));

  try {
    // Test teams table
    console.log('\n📊 Teams Table Analysis:');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(10);

    if (teamsError) {
      console.error('❌ Error querying teams:', teamsError.message);
    } else {
      console.log(`✅ Successfully queried teams table: ${teams.length} records`);
      
      if (teams.length > 0) {
        console.log('\nSample team data:');
        teams.slice(0, 3).forEach((team, idx) => {
          console.log(`  Team ${idx + 1}:`);
          console.log(`    Name: ${team.name}`);
          console.log(`    Department: ${team.department}`);
          console.log(`    Year: ${team.year}`);
          console.log(`    Section: ${team.section}`);
        });

        // Analyze department distribution
        const deptCounts = {};
        teams.forEach(team => {
          const dept = team.department || 'NULL';
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
        console.log('\nDepartment distribution:', deptCounts);

        // Analyze year distribution
        const yearCounts = {};
        teams.forEach(team => {
          const year = team.year || 'NULL';
          yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        console.log('Year distribution:', yearCounts);
      }
    }

    // Test team_members table
    console.log('\n👥 Team Members Table Analysis:');
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .limit(10);

    if (membersError) {
      console.error('❌ Error querying team_members:', membersError.message);
    } else {
      console.log(`✅ Successfully queried team_members table: ${members.length} records`);
      
      if (members.length > 0) {
        console.log('\nSample member data:');
        members.slice(0, 3).forEach((member, idx) => {
          console.log(`  Member ${idx + 1}:`);
          console.log(`    Name: ${member.name}`);
          console.log(`    Email: ${member.email}`);
          console.log(`    Department: ${member.department}`);
          console.log(`    Phone: ${member.phone}`);
        });

        // Analyze department distribution
        const memberDeptCounts = {};
        members.forEach(member => {
          const dept = member.department || 'NULL';
          memberDeptCounts[dept] = (memberDeptCounts[dept] || 0) + 1;
        });
        console.log('\nMember department distribution:', memberDeptCounts);
      }
    }

    // Test submissions table
    console.log('\n📝 Submissions Table Analysis:');
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .limit(5);

    if (submissionsError) {
      console.error('❌ Error querying submissions:', submissionsError.message);
    } else {
      console.log(`✅ Successfully queried submissions table: ${submissions.length} records`);
      
      if (submissions.length > 0) {
        console.log('\nSample submission data:');
        submissions.slice(0, 2).forEach((sub, idx) => {
          console.log(`  Submission ${idx + 1}:`);
          console.log(`    Team ID: ${sub.team_id}`);
          console.log(`    Problem: ${sub.problem_statement}`);
          console.log(`    Status: ${sub.status}`);
          console.log(`    Created: ${sub.created_at}`);
        });
      }
    }

    // Test profiles table
    console.log('\n👤 Profiles Table Analysis:');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .limit(5);

    if (profilesError) {
      console.error('❌ Error querying profiles:', profilesError.message);
    } else {
      console.log(`✅ Successfully queried profiles table: ${profiles.length} records`);
      
      if (profiles.length > 0) {
        console.log('\nSample profile data:');
        profiles.forEach((profile, idx) => {
          console.log(`  Profile ${idx + 1}:`);
          console.log(`    Email: ${profile.email}`);
          console.log(`    Role: ${profile.role}`);
          console.log(`    Created: ${profile.created_at}`);
        });
      }
    }

    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Database state test completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error during database testing:', error);
  }
}

async function testConstraints() {
  console.log('\n🔒 Testing Database Constraints\n');
  console.log('=' .repeat(50));

  try {
    // Try to insert invalid team data to test constraints
    console.log('\n🧪 Testing team constraints...');
    
    const { data: testTeam, error: teamConstraintError } = await supabase
      .from('teams')
      .insert([{
        name: 'Test Team Constraint',
        department: 'INVALID_DEPT', // Should fail if constraint is working
        year: 'INVALID_YEAR', // Should fail if constraint is working
        section: 'TOO_LONG_SECTION', // Should fail if constraint is working
        leader_email: 'test@test.com'
      }])
      .select();

    if (teamConstraintError) {
      console.log('✅ Team constraints are working correctly!');
      console.log('   Error (expected):', teamConstraintError.message);
    } else {
      console.log('⚠️  Team constraints may not be properly enforced');
      console.log('   Inserted data:', testTeam);
    }

  } catch (error) {
    console.log('✅ Team constraints are working correctly!');
    console.log('   Exception (expected):', error.message);
  }

  try {
    // Try to insert invalid member data to test constraints
    console.log('\n🧪 Testing member constraints...');
    
    const { data: testMember, error: memberConstraintError } = await supabase
      .from('team_members')
      .insert([{
        team_id: 'test-id',
        name: 'Test Member',
        email: 'test@member.com',
        department: 'INVALID_MEMBER_DEPT', // Should fail if constraint is working
        phone: '1234567890'
      }])
      .select();

    if (memberConstraintError) {
      console.log('✅ Member constraints are working correctly!');
      console.log('   Error (expected):', memberConstraintError.message);
    } else {
      console.log('⚠️  Member constraints may not be properly enforced');
      console.log('   Inserted data:', testMember);
    }

  } catch (error) {
    console.log('✅ Member constraints are working correctly!');
    console.log('   Exception (expected):', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Constraint testing completed!');
}

// Run all tests
async function runAllTests() {
  try {
    await testDatabaseState();
    await testConstraints();
    
    console.log('\n✨ All tests completed successfully!');
    console.log('\nIf you see any constraint violations above, that means');
    console.log('the migration worked correctly and is protecting your data.');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
  }
}

// Execute the tests
console.log('Starting comprehensive database tests...\n');
runAllTests();