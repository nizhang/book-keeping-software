import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useClasses = () =>
  useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes') });

export const useCreateClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/classes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
};

export const useUpdateClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/classes/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
};

export const useDeleteClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
};
