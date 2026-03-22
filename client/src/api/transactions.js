import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useTransactions = (filters = {}) =>
  useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, v); });
      return api.get(`/transactions?${params}`);
    },
  });

export const useUpdateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/transactions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
};

export const useDeleteTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
};

export const useCategorize = () => {
  const qc = useQueryClient();
  return useMutation({
    // splits: [{ categoryAccountId, amount, classId?, memo? }]
    mutationFn: ({ id, splits }) =>
      api.post(`/transactions/${id}/categorize`, { splits }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useUncategorize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/transactions/${id}/categorize`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useFlipAmount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/transactions/${id}/flip-amount`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useMergeCategorize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/transactions/merge-categorize', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useBulkCategorize = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/transactions/bulk-categorize', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
