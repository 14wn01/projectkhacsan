const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const cust = {
    id: 'test_cust',
    name: 'Test Customer',
    phone: '0000000009',
    email: '',
    idNumber: '',
    address: '',
    createdAt: new Date().toISOString(),
    consentAt: new Date().toISOString()
  };
  
  console.log('Inserting customer...');
  const res1 = await supabase.from('customers').upsert(cust);
  console.log('Customer result:', res1.error ? res1.error.message : 'Success');
  
  const user = {
    id: 'test_user',
    name: 'Test User',
    username: '0000000009',
    password: 'password123',
    role: 'guest',
    phone: '0000000009',
    email: '',
    customerId: 'test_cust'
  };
  
  console.log('Inserting user...');
  const res2 = await supabase.from('users').upsert(user);
  console.log('User result:', res2.error ? res2.error.message : 'Success');

  console.log('Cleaning up test record...');
  await supabase.from('users').delete().eq('id', 'test_user');
  await supabase.from('customers').delete().eq('id', 'test_cust');
  console.log('Cleaned up!');
}
test();
