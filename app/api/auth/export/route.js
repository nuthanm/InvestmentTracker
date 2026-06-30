import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security';

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function arrayToCSV(headers, rows) {
  const headerRow = headers.map(h => escapeCSV(h)).join(',');
  const dataRows = rows.map(row => {
    return headers.map(header => escapeCSV(row[header])).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

export async function GET(req) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const [goals, investments, payments, notifications] = await Promise.all([
      sql`SELECT * FROM goals WHERE user_id = ${me.id}`,
      sql`SELECT * FROM investments WHERE user_id = ${me.id}`,
      sql`SELECT * FROM payment_records WHERE user_id = ${me.id}`,
      sql`SELECT * FROM notifications WHERE user_id = ${me.id}`,
    ]);

    // Build CSV content
    const csvSections = [];
    
    // Goals section
    if (goals.length > 0) {
      const goalHeaders = Object.keys(goals[0]);
      csvSections.push('GOALS');
      csvSections.push(arrayToCSV(goalHeaders, goals));
      csvSections.push('');
    }
    
    // Investments section
    if (investments.length > 0) {
      const investmentHeaders = Object.keys(investments[0]);
      csvSections.push('INVESTMENTS');
      csvSections.push(arrayToCSV(investmentHeaders, investments));
      csvSections.push('');
    }
    
    // Payment Records section
    if (payments.length > 0) {
      const paymentHeaders = Object.keys(payments[0]);
      csvSections.push('PAYMENT RECORDS');
      csvSections.push(arrayToCSV(paymentHeaders, payments));
      csvSections.push('');
    }
    
    // Notifications section
    if (notifications.length > 0) {
      const notificationHeaders = Object.keys(notifications[0]);
      csvSections.push('NOTIFICATIONS');
      csvSections.push(arrayToCSV(notificationHeaders, notifications));
      csvSections.push('');
    }

    const csvContent = csvSections.join('\n');

    await logSecurityEvent({ req, userId: me.id, eventType: 'data_export', status: 'success' });

    const filename = `investment-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('data export error', err);
    return NextResponse.json({ error: 'Could not export data.' }, { status: 500 });
  }
}
