import { supabase } from '../db/supabase';
import type { Transaction } from '../db/database';
import { buildHistoryCsv } from './historyCsv';

export async function generateHistoryCsv() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('deleted', false)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch transactions for export:', error);
    alert('Failed to export transactions.');
    return;
  }

  const csvContent = buildHistoryCsv((data ?? []) as Transaction[]);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'treasury_report.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
