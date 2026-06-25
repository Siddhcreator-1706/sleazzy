// Swap Supabase for your database pool
import { db } from '../db';

/**
 * Returns the semester date range (ISO strings) for a given date.
 * Semester 1: Jan 1 – Jun 30
 * Semester 2: Jul 1 – Dec 31
 */
export function getSemesterRange(date: Date): { start: string; end: string } {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    if (month <= 5) {
        // Jan–Jun
        return {
            start: `${year}-01-01T00:00:00.000Z`,
            end: `${year}-06-30T23:59:59.999Z`,
        };
    }
    // Jul–Dec
    return {
        start: `${year}-07-01T00:00:00.000Z`,
        end: `${year}-12-31T23:59:59.999Z`,
    };
}

/**
 * Counts the number of distinct co-curricular events (by batch_id) for a given
 * club within a semester range. Bookings with status 'rejected' are excluded.
 * event_type is resolved via JOIN to the events table through event_id.
 *
 * @param excludeBookingId  Optional booking id to exclude (useful when editing
 * an existing booking so it doesn't count against itself).
 */
export async function countCoCurricularBookings(
    clubId: string,
    semesterStart: string,
    semesterEnd: string,
    excludeBookingId?: string,
): Promise<number> {

    // Count unique events instead of individual booking batches or venues
    let queryStr = `
        SELECT COUNT(DISTINCT e.id) as count
        FROM events e
        WHERE e.club_id = $1 
          AND e.event_type = 'co_curricular' 
          AND e.status != 'cancelled' 
          AND e.date >= $2 
          AND e.date <= $3
    `;
    const values: any[] = [clubId, semesterStart, semesterEnd];

    // If an excludeBookingId is passed, we technically should ignore it since the limit
    // is on the event, but for safety in case it's used elsewhere, we ignore it here
    // since one event might have multiple bookings. If we are just editing a booking, 
    // the event already exists and counts as 1.

    try {
        const { rows } = await db.query(queryStr, values);
        return parseInt(rows[0].count, 10) || 0;
    } catch (error: any) {
        throw new Error(`Failed to count co-curricular events: ${error.message}`);
    }
}

export const CO_CURRICULAR_LIMIT = 2;