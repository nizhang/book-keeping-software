import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useOpeningBalances() {
  return useQuery({
    queryKey: ['opening-balances'],
    queryFn: () => api.get('/opening-balances'),
  });
}

export function useSaveOpeningBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ asOfDate, lines }) =>
      api.post('/opening-balances', { asOfDate, lines }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-balances'] });
      // Opening balances affect the Balance Sheet
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
