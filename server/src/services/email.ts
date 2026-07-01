import emailjs from '@emailjs/nodejs';

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const APPROVAL_MAIL = process.env.APPROVAL_MAIL;
const PASSWORD_MAIL = process.env.PASSWORD_MAIL;
const EVENT_REMINDER_MAIL = process.env.EVENT_REMINDER_MAIL;

export type PendingBookingItem = {
  venueName: string;
  eventName: string;
  startTime: string;
  endTime: string;
  clubName?: string;
  eventType?: string;
};

function formatEventTypeLabel(eventType?: string): string {
  if (!eventType) return 'General';
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function isEmailJsConfigured(): boolean {
  return !!(
    EMAILJS_SERVICE_ID &&
    EMAILJS_TEMPLATE_ID &&
    EMAILJS_PUBLIC_KEY &&
    EMAILJS_PRIVATE_KEY
  );
}


/**
 * Send an email to the user with a temporary password when they trigger a forgot password request.
 */
export async function sendPasswordResetEmail(
  email: string,
  tempPassword: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailJsConfigured()) {
    console.warn('EmailJS not configured; skipping password reset email.');
    return { sent: false };
  }

  const title = 'Password Reset Request';
  const subject = 'Password Reset - Sleazzy';
  const message = `Dear User,\n\nWe received a request to reset your password. Your new temporary password is:\n\n${tempPassword}\n\nPlease use this password to log in and change your password in settings if needed.\n\nRegards,\nSleazzy Team`;
  const messageHtml = `
    <p>Dear User,</p>
    <p>We received a request to reset your password. Your new temporary password is:</p>
    <h3 style="background:#f4f4f4; padding:10px; display:inline-block; font-family:monospace; border-radius:4px; margin: 10px 0;">${tempPassword}</h3>
    <p>Please use this password to log in.</p>
    <p>Regards,<br/>Sleazzy Team</p>
  `;

  const templateParams = {
    to_email: email,
    from_email: PASSWORD_MAIL || '',
    title,
    subject,
    message,
    message_html: messageHtml,
    booking_count: '0',
  };

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID!,
      EMAILJS_TEMPLATE_ID!,
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY!,
        privateKey: EMAILJS_PRIVATE_KEY!,
      }
    );
    return { sent: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err, null, 2);
    console.error('Failed to send password reset email:', errorMsg);
    return { sent: false, error: errorMsg };
  }
}

/**
 * Send an email to the club when their booking is approved.
 */
export async function sendBookingApprovedEmailToClub(
  clubEmail: string,
  venueName: string,
  eventName: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailJsConfigured()) return { sent: false };

  const title = 'Booking Approved';
  const subject = 'Booking Approved - Sleazzy';
  const message = `Your booking for ${eventName} at ${venueName} on ${date} from ${startTime} to ${endTime} has been approved.`;
  const messageHtml = `<p>Your booking for <strong>${eventName}</strong> at <strong>${venueName}</strong> on <strong>${date}</strong> from <strong>${startTime}</strong> to <strong>${endTime}</strong> has been approved.</p>`;

  const templateParams = {
    to_email: clubEmail,
    from_email: APPROVAL_MAIL || '',
    title,
    subject,
    message,
    message_html: messageHtml,
    booking_count: '1',
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID!, EMAILJS_TEMPLATE_ID!, templateParams, {
      publicKey: EMAILJS_PUBLIC_KEY!,
      privateKey: EMAILJS_PRIVATE_KEY!,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

/**
 * Send an event report reminder to the club.
 */
export async function sendEventReportReminderEmail(
  clubEmail: string,
  eventName: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailJsConfigured()) return { sent: false };

  const title = 'Event Report Reminder';
  const subject = 'Event Report Reminder - Sleazzy';
  const message = `This is a reminder to submit the event report for your recent event: ${eventName}.`;
  const messageHtml = `<p>This is a reminder to submit the event report for your recent event: <strong>${eventName}</strong>.</p>`;

  const templateParams = {
    to_email: clubEmail,
    from_email: EVENT_REMINDER_MAIL || '',
    title,
    subject,
    message,
    message_html: messageHtml,
    booking_count: '0',
  };

  try {
    await emailjs.send(EMAILJS_SERVICE_ID!, EMAILJS_TEMPLATE_ID!, templateParams, {
      publicKey: EMAILJS_PUBLIC_KEY!,
      privateKey: EMAILJS_PRIVATE_KEY!,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
