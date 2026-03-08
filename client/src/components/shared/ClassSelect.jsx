import { useClasses } from '../../api/classes';

export default function ClassSelect({ value, onChange, placeholder = 'No class', style }) {
  const { data: classes = [], isLoading } = useClasses();

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}
      disabled={isLoading}
      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', ...style }}
    >
      <option value="">{placeholder}</option>
      {classes.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
