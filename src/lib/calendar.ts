import { google } from 'googleapis';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { 
  parseISO, 
  isWithinInterval, 
  setHours, 
  setMinutes, 
  addMinutes, 
  parse, 
  isBefore, 
  isAfter, 
  areIntervalsOverlapping, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  format,
  addHours,
  addDays
} from 'date-fns';

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  timeSlots: TimeSlot[];
  isAvailable: boolean;
}

interface AvailabilitySettings {
  weekly_availability: DayAvailability[];
  time_zone: string;
  meeting_duration: number;
  meeting_price: number;
  currency: string;
}


async function refreshToken(userId: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('No access token returned after refresh');
    }

    // Update the token in your database
    const { error: updateError } = await supabase
      .from('calendar_tokens')
      .update({
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating token in database:', updateError);
      throw new Error('Failed to update token in database');
    }

    return credentials.access_token;
  } catch (error: any) {
    console.error('Detailed refresh token error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}



function calculateAvailableSlots(
  availabilitySettings: AvailabilitySettings,
  calendarEvents: any[],
  date: Date,
  calendarTimeZone: string
): { [day: string]: TimeSlot[] } {
  const availableSlots: { [day: string]: TimeSlot[] } = {};
  const { weekly_availability, meeting_duration, time_zone } = availabilitySettings;

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  daysInMonth.forEach((day, index) => {
    const dayOfWeek = index % 7;
    const dayAvailability = weekly_availability[dayOfWeek];

    if (dayAvailability.isAvailable) {
      const dayKey = format(day, 'yyyy-MM-dd');
      availableSlots[dayKey] = [];

      for (const slot of dayAvailability.timeSlots) {
        const [startHour, startMinute] = slot.start.split(':').map(Number);
        const [endHour, endMinute] = slot.end.split(':').map(Number);

        let slotStart = fromZonedTime(setMinutes(setHours(day, startHour), startMinute), time_zone);
        const slotEnd = fromZonedTime(setMinutes(setHours(day, endHour), endMinute), time_zone);

        while (isBefore(slotStart, slotEnd)) {
          const potentialEndTime = addMinutes(slotStart, meeting_duration);
          
          if (isAfter(potentialEndTime, slotEnd)) {
            break;
          }

          const isOverlapping = calendarEvents.some(event => {
            let eventStartUTC: Date, eventEndUTC: Date;

            if (event.start.dateTime) {
              eventStartUTC = parseISO(event.start.dateTime);
              eventEndUTC = event.end.dateTime 
                ? parseISO(event.end.dateTime)
                : addHours(eventStartUTC, 1);
            } else if (event.start.date) {
              eventStartUTC = parseISO(event.start.date);
              eventEndUTC = event.end.date 
                ? parseISO(event.end.date)
                : addDays(eventStartUTC, 1);
            } else {
              return false;
            }

            return isWithinInterval(slotStart, { start: eventStartUTC, end: eventEndUTC }) ||
                   isWithinInterval(potentialEndTime, { start: eventStartUTC, end: eventEndUTC }) ||
                   (isBefore(slotStart, eventStartUTC) && isAfter(potentialEndTime, eventEndUTC));
          });

          if (!isOverlapping) {
            availableSlots[dayKey].push({ 
              start: slotStart.toISOString(),
              end: potentialEndTime.toISOString()
            });
          }

          slotStart = potentialEndTime;
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

  // Fetch user's calendar tokens
  const { data: calendarTokens, error: tokensError } = await supabase
      .from('calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

  if (tokensError) {
      throw new Error('Calendar tokens not found');
  }

  // Check if token is expired and refresh if necessary
  const now = Date.now();
  if (now >= calendarTokens.expiry_date) {
    try {
      const newAccessToken = await refreshToken(userId, calendarTokens.refresh_token);
      calendarTokens.access_token = newAccessToken;
    } catch (refreshError) {
      console.error('Error refreshing token:', refreshError);
      throw new Error('Failed to refresh access token');
    }
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
  const availableSlots = calculateAvailableSlots(
    availabilitySettings,
    events.items || [],
    month,
    events.timeZone || 'UTC'
  );

  console.log('SET: ', availabilitySettings)
  return availableSlots;

  return {events, availabilitySettings};
}

