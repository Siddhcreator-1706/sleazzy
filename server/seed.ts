import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import * as xlsx from 'xlsx';
import path from 'path';

dotenv.config();

const ADMIN_EMAIL = 'sbg_convener@dau.ac.in';
const OFFICIAL_EMAIL_DOMAIN = '@dau.ac.in';

// Official clubs/committees array from client constants - used to map group categories
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

    // 2. Seed Venues
    console.log('Seeding 15 default venues...');
    for (const v of VENUES) {
      await client.query(
        `INSERT INTO public.venues (name, category, capacity) VALUES ($1, $2, $3)`,
        [v.name, v.category, String(v.capacity)]
      );
    }
    console.log(`✓ 15 venues seeded`);

    // 3. Seed Clubs from CSV
    console.log('Reading clubs from CSV...');
    const csvPath = path.join(__dirname, 'clubs_seeding_info.csv');
    const workbook = xlsx.readFile(csvPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Use header: 1 to read as an array of arrays, making it immune to small header string inconsistencies
    const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    let seededClubs = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue; // Skip empty/invalid rows

      const email = String(row[1] || '').trim();
      const clubName = String(row[2] || '').trim();

      const convenerName = String(row[3] || '').trim();
      const convenerId = String(row[4] || '').trim();
      const convenerMobile = String(row[5] || '').trim();

      const dyConvenerName = String(row[6] || '').trim();
      const dyConvenerId = String(row[7] || '').trim();
      const dyConvenerMobile = String(row[8] || '').trim();

      const mentorName = String(row[9] || '').trim();

      if (!email || !clubName) continue;

      // Group category matching
      let groupCategory = 'A'; // Default to A
      const matchingClub = CLUBS.find(c =>
        clubName.toLowerCase().includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(clubName.toLowerCase().replace('club', '').trim())
      );
      if (matchingClub) {
        groupCategory = matchingClub.group;
      }

      const clubUserId = randomUUID();

      // auth.users
      await client.query(
        `INSERT INTO auth.users (id, email, encrypted_password) VALUES ($1, $2, $3)`,
        [clubUserId, email, defaultHashedPassword]
      );

      // profiles
      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role) VALUES ($1, $2, $3, $4)`,
        [clubUserId, email, clubName, 'club']
      );

      // clubs
      const clubRes = await client.query(
        `INSERT INTO public.clubs (name, email, group_category) VALUES ($1, $2, $3) RETURNING id`,
        [clubName, email, groupCategory]
      );
      const clubId = clubRes.rows[0].id;

      // Club Members Insertions

      // Convener
      if (convenerName && convenerName !== 'N/A' && convenerName !== '-') {
        await client.query(
          `INSERT INTO public.club_members (club_id, full_name, roll_number, phone, designation, is_core_member)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [clubId, convenerName, convenerId === 'N/A' || convenerId === '-' ? null : convenerId,
            convenerMobile === 'N/A' || convenerMobile === '-' ? null : convenerMobile, 'Convener', true]
        );
      }

      // Deputy Convener
      if (dyConvenerName && dyConvenerName !== 'N/A' && dyConvenerName !== '-') {
        await client.query(
          `INSERT INTO public.club_members (club_id, full_name, roll_number, phone, designation, is_core_member)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [clubId, dyConvenerName, dyConvenerId === 'N/A' || dyConvenerId === '-' ? null : dyConvenerId,
            dyConvenerMobile === 'N/A' || dyConvenerMobile === '-' ? null : dyConvenerMobile, 'Deputy Convener', true]
        );
      }

      // Faculty Mentor
      if (mentorName && mentorName !== 'N/A' && mentorName !== '-') {
        await client.query(
          `INSERT INTO public.club_members (club_id, full_name, designation, is_core_member)
           VALUES ($1, $2, $3, $4)`,
          [clubId, mentorName, 'Faculty Mentor', true]
        );
      }

      seededClubs++;
      console.log(`  ✓ Seeded: ${clubName} (${email}) - Group ${groupCategory}`);
    }

    console.log(`✓ Seeded ${seededClubs} clubs from CSV.`);
    console.log('Seeding complete!');

  } catch (error) {
    console.error('Seeding process failed:', error);
  } finally {
    await client.end();
  }
}

seed();