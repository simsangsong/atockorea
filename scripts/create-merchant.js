/**
 * Script to create a merchant account
 * Usage: node scripts/create-merchant.js
 * 
 * This script creates a merchant account directly in Supabase
 * You need to set SUPABASE_SERVICE_ROLE_KEY in environment
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing environment variables');
  console.error('Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createMerchant() {
  const merchantData = {
    company_name: 'LoveKorea Travel',
    business_registration_number: 'LOVE-KOREA-2024',
    contact_person: 'LoveKorea Admin',
    contact_email: 'admin@lovekorea.com',
    contact_phone: '010-0000-0000',
    address_line1: '123 Travel Street',
    city: 'Seoul',
    province: 'Seoul',
    postal_code: '00000',
    country: 'South Korea',
  };

  // Generate temporary password
  const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16) + '!Aa1';

  console.log('Creating merchant account...');
  console.log('Company:', merchantData.company_name);
  console.log('Email:', merchantData.contact_email);

  try {
    // 1. Create user account
    console.log('\n1. Creating user account...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: merchantData.contact_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'merchant',
        company_name: merchantData.company_name,
        contact_person: merchantData.contact_person,
        needs_password_change: true,
        created_by_admin: true,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating user:', authError?.message);
      process.exit(1);
    }

    console.log('✓ User account created:', authData.user.id);

    // 2. Create user profile
    console.log('\n2. Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: merchantData.contact_person,
        role: 'merchant',
      });

    if (profileError) {
      console.error('Error creating profile:', profileError.message);
      // Rollback: delete user
      await supabase.auth.admin.deleteUser(authData.user.id);
      process.exit(1);
    }

    console.log('✓ User profile created');

    // 3. Create merchant record
    console.log('\n3. Creating merchant record...');
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .insert({
        user_id: authData.user.id,
        company_name: merchantData.company_name,
        business_registration_number: merchantData.business_registration_number,
        contact_person: merchantData.contact_person,
        contact_email: merchantData.contact_email,
        contact_phone: merchantData.contact_phone,
        address_line1: merchantData.address_line1,
        city: merchantData.city,
        province: merchantData.province,
        postal_code: merchantData.postal_code,
        country: merchantData.country,
        status: 'active', // Set to active for testing
        is_verified: true,
      })
      .select()
      .single();

    if (merchantError) {
      console.error('Error creating merchant:', merchantError.message);
      // Rollback
      await supabase.from('user_profiles').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      process.exit(1);
    }

    console.log('✓ Merchant record created:', merchant.id);

    // 4. Create default settings
    console.log('\n4. Creating default settings...');
    const { error: settingsError } = await supabase
      .from('merchant_settings')
      .insert({
        merchant_id: merchant.id,
      });

    if (settingsError) {
      console.warn('Warning: Could not create settings:', settingsError.message);
    } else {
      console.log('✓ Default settings created');
    }

    // 5. Create audit log
    console.log('\n5. Creating audit log...');
    await supabase
      .from('audit_logs')
      .insert({
        user_id: authData.user.id,
        action: 'merchant_created',
        resource_type: 'merchant',
        resource_id: merchant.id,
        details: {
          company_name: merchantData.company_name,
          contact_email: merchantData.contact_email,
          created_by: 'script',
        },
      })
      .catch(() => {
        console.warn('Warning: Could not create audit log (table might not exist)');
      });

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('✅ Merchant account created successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 Login Credentials:');
    console.log('   Email:', merchantData.contact_email);
    console.log('   Password:', tempPassword);
    console.log('\n🌐 Login URL:');
    console.log('   http://localhost:3000/merchant/login');
    console.log('\n⚠️  IMPORTANT:');
    console.log('   - Save these credentials securely');
    console.log('   - User must change password on first login');
    console.log('   - Merchant ID:', merchant.id);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
createMerchant();

