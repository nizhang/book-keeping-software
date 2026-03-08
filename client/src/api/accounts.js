import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts') });

export const useAccount = (id) =>
  useQuery({ queryKey: ['accounts', id], queryFn: () => api.get(`/accounts/${id}`), enabled: !!id });

export const useCreateAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/accounts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
};

export const useUpdateAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/accounts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
};

export const useDeleteAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
};
