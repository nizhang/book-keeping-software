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

export const useDrilldown = (params) => {
  const { accountId, startDate, endDate, classId, includeOpeningBalance } = params || {};
  const qs = new URLSearchParams();
  if (accountId)            qs.set('accountId', accountId);
  if (startDate)            qs.set('startDate', startDate);
  if (endDate)              qs.set('endDate', endDate);
  if (classId)              qs.set('classId', classId);
  if (includeOpeningBalance) qs.set('includeOpeningBalance', '1');
  return useQuery({
    queryKey: ['reports', 'drilldown', accountId, startDate, endDate, classId, includeOpeningBalance],
    queryFn: () => api.get(`/reports/drilldown?${qs}`),
    enabled: !!accountId,
  });
};
