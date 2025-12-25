/**
 * Check if a tour exists in production database
 * Usage: node scripts/check-tour-in-production.js <tourId>
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkTour(tourId) {
  console.log(`\n🔍 Checking tour: ${tourId}\n`);

  // Check if it's a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourId);

  // 1. Check as UUID (without is_active filter)
  let { data: tourById, error: errorById } = await supabase
    .from('tours')
    .select('id, title, slug, city, is_active, created_at')
    .eq('id', tourId)
    .maybeSingle();

  // 2. Check as slug (without is_active filter)
  let { data: tourBySlug, error: errorBySlug } = await supabase
    .from('tours')
    .select('id, title, slug, city, is_active, created_at')
    .eq('slug', tourId)
    .maybeSingle();

  const tour = tourById || tourBySlug;

  if (tour) {
    console.log('✅ Tour found!');
    console.log({
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      city: tour.city,
      is_active: tour.is_active,
      created_at: tour.created_at,
    });

    if (!tour.is_active) {
      console.log('\n⚠️  WARNING: Tour is inactive (is_active = false)');
      console.log('   This is why the API returns 404 - only active tours are returned.\n');
    } else {
      console.log('\n✅ Tour is active - should be accessible via API\n');
    }
  } else {
    console.log('❌ Tour not found in database');
    console.log('   Error by ID:', errorById?.message || 'none');
    console.log('   Error by slug:', errorBySlug?.message || 'none');
  }

  // 3. Get statistics
  const { data: allTours, error: allToursError } = await supabase
    .from('tours')
    .select('id, title, is_active')
    .limit(1000);

  if (!allToursError && allTours) {
    const activeCount = allTours.filter(t => t.is_active).length;
    const inactiveCount = allTours.filter(t => !t.is_active).length;
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Total tours: ${allTours.length}`);
    console.log(`   Active tours: ${activeCount}`);
    console.log(`   Inactive tours: ${inactiveCount}`);
  }

  // 4. Check environment variables
  console.log('\n🔧 Environment Check:');
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? '✅ Set' : '❌ Missing'}`);
  if (supabaseUrl) {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    console.log(`   Project Ref: ${projectRef || 'unknown'}`);
  }
}

const tourId = process.argv[2];

if (!tourId) {
  console.error('❌ Please provide a tour ID');
  console.error('Usage: node scripts/check-tour-in-production.js <tourId>');
  console.error('Example: node scripts/check-tour-in-production.js d7691042-120b-4699-90b7-9cd0ac013898');
  process.exit(1);
}

checkTour(tourId)
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });

