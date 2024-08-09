import { google } from 'googleapis';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addMinutes, parse, isBefore, isAfter, areIntervalsOverlapping } from 'date-fns';

interface AvailabilitySettings {
  weeklyAvailability: {
    [key: string]: { start: string; end: string }[];
  };
  meetingDuration: number; // in minutes
}

interface CalendarEvent {
  start: { dateTime: string };
  end: { dateTime: string };
}

interface TimeSlot {
  start: Date;
  end: Date;
}

function calculateAvailableSlots(
  availabilitySettings: AvailabilitySettings,
  calendarEvents: CalendarEvent[],
  startDate: Date,
  endDate: Date
): TimeSlot[] {
  const availableSlots: TimeSlot[] = [];
  const { weeklyAvailability, meetingDuration } = availabilitySettings;

  // Iterate through each day from startDate to endDate
  for (let date = new Date(startDate); isBefore(date, endDate); date = addMinutes(date, 1440)) {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dayAvailability = weeklyAvailability[dayOfWeek];

    if (dayAvailability) {
      // For each availability window on this day
      for (const window of dayAvailability) {
        const windowStart = parse(window.start, 'HH:mm', date);
        const windowEnd = parse(window.end, 'HH:mm', date);

        // Generate potential slots within this window
        for (let slotStart = windowStart; isBefore(slotStart, windowEnd); slotStart = addMinutes(slotStart, meetingDuration)) {
          const slotEnd = addMinutes(slotStart, meetingDuration);
          
          // Check if the slot ends after the window end time
          if (isAfter(slotEnd, windowEnd)) {
            break;
          }

          // Check if the slot overlaps with any calendar events
          const isOverlapping = calendarEvents.some(event => 
            areIntervalsOverlapping(
              { start: slotStart, end: slotEnd },
              { start: new Date(event.start.dateTime), end: new Date(event.end.dateTime) }
            )
          );

          if (!isOverlapping) {
            availableSlots.push({ start: slotStart, end: slotEnd });
          }
        }
      }
    }
  }

  return availableSlots;
}

export async function getAvailableSlots(userId: string, startDate: Date, endDate: Date) {

    // Initialize Supabase client
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
    )
    // Fetch user's availability settings
    const { data: availabilitySettings } = await supabase
        .from('availability_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    // Fetch user's calendar tokens
    const { data: calendarTokens } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    // Set up Google Calendar API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: calendarTokens.access_token,
        refresh_token: calendarTokens.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch calendar events
    const { data: events } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
    });

    // Cross-reference availability settings with calendar events
    // This is a simplified example - you'll need to implement the actual logic
    const availableSlots = calculateAvailableSlots(availabilitySettings, events.items as CalendarEvent[], startDate, endDate);

    return availableSlots;
}