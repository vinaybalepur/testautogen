import { User, JwtPayload } from '../types';

// Test User type
const testUser: User = {
  id:             1,
  first_name:     'John',
  last_name:      'Doe',
  email:          'john@test.com',
  password_hash:  'hashedpassword',
  is_active:      true,
  last_login_at:  null,
  created_at:     new Date()
};

// Test JwtPayload type
const testPayload: JwtPayload = {
  userId: 1
};

console.log('✅ User type works:', testUser.first_name, testUser.last_name);
console.log('✅ JwtPayload type works:', testPayload.userId);