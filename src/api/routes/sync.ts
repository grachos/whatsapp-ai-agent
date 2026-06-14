import { Router, Request, Response, NextFunction } from 'express';
import { runSyncValidation, getLastSyncReport } from '../../services/sync.service';
import { createCalendarEvent, deleteCalendarEvent } from '../../integrations/google-calendar/client';
import { config } from '../../config';

const router = Router();

// Diagnostic: creates a temporary event on the configured calendar and deletes it.
// Reveals permission/ID problems immediately.
router.get('/test-calendar', async (_req: Request, res: Response) => {
  const calendarId = config.google.calendarId;
  try {
    const today = new Date();
    const d1 = today.toISOString().split('T')[0];
    const d2 = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
    const eventId = await createCalendarEvent('TEST', 'TEST EVENT', 'Diagnostic', 1, d1, d2);
    res.json({
      success: true,
      calendarId,
      eventId,
      message: `Test event created on "${calendarId}" and will be deleted in 30s. If you see it appear, the calendar config is correct.`,
    });
    setTimeout(() => { deleteCalendarEvent(eventId).catch(() => {}); }, 30000);
  } catch (err) {
    res.status(500).json({
      success: false,
      calendarId,
      error: err instanceof Error ? err.message : String(err),
      hint: 'A 403/permission error means the service account lacks "Make changes to events" access on this calendar. A 404 means the calendar ID is wrong.',
    });
  }
});

router.post('/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await runSyncValidation();
    res.json({ report });
  } catch (err) { next(err); }
});

router.get('/report', (_req: Request, res: Response) => {
  const report = getLastSyncReport();
  if (!report) { res.json({ message: 'No sync report available yet. POST /api/sync/run to generate one.' }); return; }
  res.json({ report });
});

export default router;
