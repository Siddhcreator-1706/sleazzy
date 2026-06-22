import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

async function seedVenues() {
    console.log('Connecting to Neon DB...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    console.log('Seeding venues...');

    const venues = [
        { name: 'Main Auditorium', category: 'needs_approval', capacity: 500, location: 'Block A' },
        { name: 'Seminar Hall 1', category: 'auto_approval', capacity: 100, location: 'Block B' },
        { name: 'Conference Room', category: 'auto_approval', capacity: 50, location: 'Block C' },
        { name: 'Sports Complex', category: 'needs_approval', capacity: 1000, location: 'South Campus' },
        { name: 'Music Room', category: 'auto_approval', capacity: 30, location: 'Student Center' }
    ];

    for (const v of venues) {
        try {
            await client.query(`
                INSERT INTO public.venues (name, category, capacity, location)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (name) DO UPDATE 
                SET category = EXCLUDED.category, 
                    capacity = EXCLUDED.capacity,
                    location = EXCLUDED.location;
            `, [v.name, v.category, v.capacity, v.location]);

            console.log(`Upserted venue: ${v.name}`);
        } catch (error) {
             console.error(`Error processing venue ${v.name}:`, error);
        }
    }

    await client.end();
    console.log('Venue Seeding complete!');
}

seedVenues();
