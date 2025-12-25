/**
 * Check if a tour exists in the database by slug
 * Usage: node scripts/check-tour-by-slug.js <slug>
 * 
 * This script checks if a tour exists in Supabase database
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables');
  console.error('Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTour(slug) {
  if (!slug) {
    console.error('Error: Please provide a slug');
    console.error('Usage: node scripts/check-tour-by-slug.js <slug>');
    process.exit(1);
  }

  console.log(`\n🔍 Checking tour with slug: "${slug}"\n`);

  try {
    // Try exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('tours')
      .select('id, title, slug, city, is_active')
      .eq('slug', slug)
      .single();

    if (exactMatch && !exactError) {
      console.log('✅ Found tour (exact match):');
      console.log('   ID:', exactMatch.id);
      console.log('   Title:', exactMatch.title);
      console.log('   Slug:', exactMatch.slug);
      console.log('   City:', exactMatch.city);
      console.log('   Is Active:', exactMatch.is_active);
      
      if (!exactMatch.is_active) {
        console.log('\n⚠️  WARNING: Tour is not active (is_active = false)');
        console.log('   This tour will not be returned by the API');
      }
      
      return;
    }

    // Try case-insensitive match
    const { data: caseInsensitiveMatch, error: caseError } = await supabase
      .from('tours')
      .select('id, title, slug, city, is_active')
      .ilike('slug', slug)
      .single();

    if (caseInsensitiveMatch && !caseError) {
      console.log('✅ Found tour (case-insensitive match):');
      console.log('   ID:', caseInsensitiveMatch.id);
      console.log('   Title:', caseInsensitiveMatch.title);
      console.log('   Slug:', caseInsensitiveMatch.slug, '(different case)');
      console.log('   City:', caseInsensitiveMatch.city);
      console.log('   Is Active:', caseInsensitiveMatch.is_active);
      
      console.log('\n⚠️  WARNING: Slug case mismatch!');
      console.log(`   Requested: "${slug}"`);
      console.log(`   Found: "${caseInsensitiveMatch.slug}"`);
      
      return;
    }

    // Get all Jeju tours to help debug
    console.log('❌ Tour not found. Checking all active Jeju tours...\n');
    
    const { data: allJejuTours, error: allError } = await supabase
      .from('tours')
      .select('id, title, slug, city, is_active')
      .eq('city', 'Jeju')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (allError) {
      console.error('Error fetching Jeju tours:', allError.message);
      return;
    }

    if (allJejuTours && allJejuTours.length > 0) {
      console.log(`Found ${allJejuTours.length} active Jeju tours:`);
      allJejuTours.forEach((tour, index) => {
        console.log(`\n${index + 1}. ${tour.title}`);
        console.log(`   Slug: "${tour.slug}"`);
        console.log(`   ID: ${tour.id}`);
        if (tour.slug.toLowerCase().includes(slug.toLowerCase())) {
          console.log(`   ⚠️  Similar to requested slug!`);
        }
      });
    } else {
      console.log('No active Jeju tours found in database.');
    }

    // Check inactive tours too
    const { data: inactiveTours, error: inactiveError } = await supabase
      .from('tours')
      .select('id, title, slug, city, is_active')
      .eq('slug', slug)
      .eq('is_active', false)
      .single();

    if (inactiveTours && !inactiveError) {
      console.log('\n⚠️  WARNING: Found tour but it is INACTIVE:');
      console.log('   Title:', inactiveTours.title);
      console.log('   Slug:', inactiveTours.slug);
      console.log('   Is Active:', inactiveTours.is_active);
      console.log('\n   To activate this tour, update is_active to true in Supabase');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Get slug from command line arguments
const slug = process.argv[2];

checkTour(slug);

