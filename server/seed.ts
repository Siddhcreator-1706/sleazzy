import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

dotenv.config();

const ADMIN_EMAIL = 'sbg_convener@dau.ac.in';
const OFFICIAL_EMAIL_DOMAIN = '@dau.ac.in';

// Official clubs/committees array from client constants
const CLUBS = [
  // Group A (Academic/Tech)
  { name: 'AI Club', group: 'A' },
  { name: 'Academic Committee', group: 'A' },
  { name: 'Business Club', group: 'A' },
  { name: 'DCEI', group: 'A' },
  { name: 'Debate Club', group: 'A' },
  { name: 'Developers Student Club', group: 'A' },
  { name: 'Electronics Hobby Club', group: 'A' },
  { name: 'Headrush', group: 'A' },
  { name: 'IEEE SB', group: 'A' },
  { name: 'Microsoft Students Technical Club', group: 'A' },
  { name: 'Muse', group: 'A' },
  { name: 'Programming Club', group: 'A' },
  { name: 'Research Club', group: 'A' },
  { name: 'Student Placement Cell', group: 'A' },
  { name: 'Tech Support Committee', group: 'A' },
  { name: 'Cyber Information and Network Security Club', group: 'A' },

  // Group B (Cultural)
  { name: 'Annual Festival Committee', group: 'B' },
  { name: 'Cafeteria Management Committee', group: 'B' },
  { name: 'Cultural Committee', group: 'B' },
  { name: 'DADC', group: 'B' },
  { name: 'DTG', group: 'B' },
  { name: 'Election Commission', group: 'B' },
  { name: 'Film Club', group: 'B' },
  { name: 'Hostel Management Committee', group: 'B' },
  { name: 'Heritage Club', group: 'B' },
  { name: 'Khelaiya Club', group: 'B' },
  { name: 'Music Club', group: 'B' },
  { name: 'Press Club', group: 'B' },
  { name: 'PMMC', group: 'B' },
  { name: 'Radio Club', group: 'B' },
  { name: 'Sambhav', group: 'B' },

  // Group C (Sports)
  { name: 'Cubing Club', group: 'C' },
  { name: 'Chess Club', group: 'C' },
  { name: 'Sports Committee', group: 'C' },
];

// Official venues array from client constants
const VENUES = [
  // Category A (Auto-Approval)
  { name: 'CEP 104', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 105', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 106', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 107', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 204', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 205', category: 'auto_approval', capacity: 100, location: 'CEP Block' },
  { name: 'OAT (Open Air Theatre)', category: 'auto_approval', capacity: 1000, location: 'Campus Ground' },
  { name: 'University Ground', category: 'auto_approval', capacity: 2000, location: 'Sports Complex' },
  { name: 'Cafeteria', category: 'auto_approval', capacity: 150, location: 'Student Center' },
  
  // Category B (Requires Admin Approval)
  { name: 'Lecture Theatre 1 (LT1)', category: 'needs_approval', capacity: 250, location: 'Lecture Theatre Block' },
  { name: 'Lecture Theatre 2 (LT2)', category: 'needs_approval', capacity: 250, location: 'Lecture Theatre Block' },
  { name: 'Lecture Theatre 3 (LT3)', category: 'needs_approval', capacity: 250, location: 'Lecture Theatre Block' },
  { name: 'CEP 110', category: 'needs_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 102', category: 'needs_approval', capacity: 100, location: 'CEP Block' },
  { name: 'CEP 108', category: 'needs_approval', capacity: 100, location: 'CEP Block' },
];

function cleanNameForEmail(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric chars with underscore
    .replace(/^_+|_+$/g, '');    // Trim leading/trailing underscores
}

async function seed() {
  console.log('Connecting to Neon DB...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    console.log('Clearing database tables...');
    await client.query(`
      TRUNCATE 
        public.bookings, 
        public.notifications, 
        public.club_members, 
        public.events, 
        public.profiles, 
        auth.users, 
        public.clubs, 
        public.venues 
      RESTART IDENTITY CASCADE;
    `);
    console.log('✓ Database cleared.');

    const defaultHashedPassword = await bcrypt.hash('password123', 10);

    // 1. Seed Admin
    console.log('Seeding admin...');
    const adminId = randomUUID();
    await client.query(
      `INSERT INTO auth.users (id, email, encrypted_password) VALUES ($1, $2, $3)`,
      [adminId, ADMIN_EMAIL, defaultHashedPassword]
    );
    await client.query(
      `INSERT INTO public.profiles (id, email, full_name, role) VALUES ($1, $2, $3, $4)`,
      [adminId, ADMIN_EMAIL, 'SBG Convener', 'admin']
    );
    console.log(`✓ Admin user & profile seeded (${ADMIN_EMAIL})`);

    // 2. Seed Clubs and Profiles
    console.log('Seeding 34 clubs and profiles...');
    const clubIds: string[] = [];
    const clubUserIds: string[] = [];
    for (const c of CLUBS) {
      const emailName = cleanNameForEmail(c.name);
      const email = `${emailName}${OFFICIAL_EMAIL_DOMAIN}`;
      
      const clubUserId = randomUUID();
      
      // auth.users
      await client.query(
        `INSERT INTO auth.users (id, email, encrypted_password) VALUES ($1, $2, $3)`,
        [clubUserId, email, defaultHashedPassword]
      );

      // profiles
      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role) VALUES ($1, $2, $3, $4)`,
        [clubUserId, email, c.name, 'club']
      );

      // clubs
      const clubRes = await client.query(
        `INSERT INTO public.clubs (name, email, group_category) VALUES ($1, $2, $3) RETURNING id`,
        [c.name, email, c.group]
      );
      clubIds.push(clubRes.rows[0].id);
      clubUserIds.push(clubUserId);
      
      console.log(`  ✓ Seeded: ${c.name} (${email})`);
    }

    // 3. Seed Venues
    console.log('Seeding 15 venues...');
    const venueIds: string[] = [];
    for (const v of VENUES) {
      const venueRes = await client.query(
        `INSERT INTO public.venues (name, category, capacity) VALUES ($1, $2, $3) RETURNING id`,
        [v.name, v.category, String(v.capacity)]
      );
      venueIds.push(venueRes.rows[0].id);
      console.log(`  ✓ Seeded venue: ${v.name} (${v.category})`);
    }

    // 4. Seed Club Members
    console.log('Seeding club members...');
    for (let i = 0; i < 5; i++) {
      await client.query(
        `INSERT INTO public.club_members (club_id, full_name, roll_number, email, designation, phone, is_core_member)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
         [clubIds[i], 'Test Member ' + i, '202300' + i, 'testmember' + i + '@dau.ac.in', 'President', '1234567890', true]
      );
    }
    console.log('  ✓ Seeded sample club members');

    // 5. Seed Events
    console.log('Seeding events...');
    const eventIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const eventRes = await client.query(
        `INSERT INTO public.events (club_id, name, date, venue) VALUES ($1, $2, $3, $4) RETURNING id`,
        [clubIds[i], 'Sample Event ' + i, new Date().toISOString(), VENUES[i].name]
      );
      eventIds.push(eventRes.rows[0].id);
    }
    console.log('  ✓ Seeded sample events');

    // 6. Seed Bookings
    console.log('Seeding bookings...');
    for (let i = 0; i < 3; i++) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + i + 1);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 2);
      
      await client.query(
        `INSERT INTO public.bookings (club_id, venue_id, start_time, end_time, status, user_id, expected_attendees, event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
         [
           clubIds[i], 
           venueIds[i], 
           startTime.toISOString(), 
           endTime.toISOString(), 
           'approved', 
           clubUserIds[i], 
           50, 
           eventIds[i]
         ]
      );
    }
    console.log('  ✓ Seeded sample bookings');

    // 7. Seed Notifications
    console.log('Seeding notifications...');
    for (let i = 0; i < 3; i++) {
      await client.query(
        `INSERT INTO public.notifications (type, title, message, user_id) VALUES ($1, $2, $3, $4)`,
        ['BOOKING_APPROVED', 'Booking Approved', 'Your booking for Sample Event ' + i + ' has been approved.', clubUserIds[i]]
      );
      await client.query(
        `INSERT INTO public.notifications (type, title, message, user_id) VALUES ($1, $2, $3, $4)`,
        ['NEW_BOOKING', 'New Booking Request', 'Club requested a venue for Sample Event ' + i, adminId]
      );
    }
    console.log('  ✓ Seeded sample notifications');

    console.log('Seeding complete! 🚀');
  } catch (error) {
    console.error('Seeding process failed:', error);
  } finally {
    await client.end();
  }
}

seed();