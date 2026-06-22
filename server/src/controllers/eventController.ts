import { Request, Response } from 'express';
import { db } from '../db';
import { getClubForUser } from '../utils/clubAuth';

export const createEvent = async (req: Request, res: Response) => {
  const { name, date, venue } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  try {
    const club = await getClubForUser(req);
    if (!club) {
      return res.status(404).json({ error: 'Club not found for this account' });
    }

    const { rows } = await db.query(
      `INSERT INTO events (club_id, name, date, venue)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [club.id, name, date, venue || null]
    );

    return res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const club = await getClubForUser(req);
    if (!club) {
      return res.status(404).json({ error: 'Club not found for this account' });
    }

    const { rows } = await db.query(
      `SELECT * FROM events
       WHERE club_id = $1
       ORDER BY date DESC, created_at DESC`,
      [club.id]
    );

    return res.json(rows);
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
};
