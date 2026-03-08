import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useImportBatches = () =>
  useQuery({ queryKey: ['import', 'batches'], queryFn: () => api.get('/import/batches') });

export const useImportFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, sourceAccountId, classId }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sourceAccountId', sourceAccountId);
      if (classId) fd.append('classId', classId);
      return api.upload('/import', fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['import', 'batches'] });
    },
  });
};

export const usePreviewFile = () =>
  useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload('/import/preview', fd);
    },
  });

export const useDeleteBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/import/batches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import', 'batches'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
