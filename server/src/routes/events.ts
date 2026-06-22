import express from 'express';
import authMiddleware from '../middleware/auth';
import { createEvent, getEvents } from '../controllers/eventController';

const router = express.Router();

router.post('/', authMiddleware, createEvent);
router.get('/', authMiddleware, getEvents);

export default router;
