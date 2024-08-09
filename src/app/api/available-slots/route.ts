import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/calendar';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const startDate = new Date(searchParams.get('startDate') as string);
  const endDate = new Date(searchParams.get('endDate') as string);

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const availableSlots = await getAvailableSlots(userId, startDate, endDate);

  return NextResponse.json({ availableSlots });
}