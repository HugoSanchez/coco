import { google } from 'googleapis';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addMinutes, parse, isBefore, isAfter, areIntervalsOverlapping, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

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

export interface TimeSlot {
  start: Date;
  end: Date;
}

function calculateAvailableSlots(
  availabilitySettings: AvailabilitySettings,
  calendarEvents: CalendarEvent[],
  date: Date
): { [day: string]: TimeSlot[] } {
  const availableSlots: { [day: string]: TimeSlot[] } = {};
  const { weeklyAvailability, meetingDuration } = availabilitySettings;

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  daysInMonth.forEach(day => {
    const dayOfWeek = day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dayAvailability = weeklyAvailability[dayOfWeek];

    if (dayAvailability) {
      availableSlots[day.toISOString().split('T')[0]] = [];

      for (const window of dayAvailability) {
        const windowStart = parse(window.start, 'HH:mm', day);
        const windowEnd = parse(window.end, 'HH:mm', day);

        for (let slotStart = windowStart; isBefore(slotStart, windowEnd); slotStart = addMinutes(slotStart, meetingDuration)) {
          const slotEnd = addMinutes(slotStart, meetingDuration);
          
          if (isAfter(slotEnd, windowEnd)) {
            break;
          }

          const isOverlapping = calendarEvents.some(event => 
            areIntervalsOverlapping(
              { start: slotStart, end: slotEnd },
              { start: new Date(event.start.dateTime), end: new Date(event.end.dateTime) }
            )
          );

          if (!isOverlapping) {
            availableSlots[day.toISOString().split('T')[0]].push({ start: slotStart, end: slotEnd });
          }
        }
      }
    }
  });

  return availableSlots;
}

export async function getAvailableSlots(username: string, month: Date) {
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

  // Fetch user's ID from the username
  const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('name', 'Henry') // We need to fix this: usernames need to be unique and always lowecase.
      .single();

  if (userError || !userData) {
      console.log(userError)
      console.log(userData)
      throw new Error('User not found');
  }

  const userId = userData.id;

  // Fetch user's availability settings
  const { data: availabilitySettings, error: settingsError } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .single();

  if (settingsError) {
      throw new Error('Availability settings not found');
  }
  else {
    console.log(availabilitySettings)
  }

  return availabilitySettings


  // Fetch user's calendar tokens
  const { data: calendarTokens, error: tokensError } = await supabase
      .from('calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

  if (tokensError) {
      throw new Error('Calendar tokens not found');
  }

  // Set up Google Calendar API client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
      access_token: calendarTokens.access_token,
      refresh_token: calendarTokens.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Fetch calendar events for the entire month
  const { data: events } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
  });

  // Calculate available slots for the entire month
  // const availableSlots = calculateAvailableSlots(availabilitySettings, events.items as CalendarEvent[], month);

  return {events, availabilitySettings};
}

