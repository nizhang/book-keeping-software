import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export const useIncomeStatement = (startDate, endDate, classId = null) => {
  const qs = new URLSearchParams({ startDate, endDate });
  if (classId) qs.set('classId', classId);
  return useQuery({
    queryKey: ['reports', 'income-statement', startDate, endDate, classId],
    queryFn: () => api.get(`/reports/income-statement?${qs}`),
    enabled: !!startDate && !!endDate,
  });
};

export const useBalanceSheet = (asOfDate, classId = null) => {
  const qs = new URLSearchParams({ asOfDate });
  if (classId) qs.set('classId', classId);
  return useQuery({
    queryKey: ['reports', 'balance-sheet', asOfDate, classId],
    queryFn: () => api.get(`/reports/balance-sheet?${qs}`),
    enabled: !!asOfDate,
  });
};
