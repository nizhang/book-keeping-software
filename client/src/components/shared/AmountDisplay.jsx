export default function AmountDisplay({ amount, style }) {
  const isNeg = amount < 0;
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
  return (
    <span style={{ color: isNeg ? '#dc2626' : '#16a34a', fontWeight: '600', fontVariantNumeric: 'tabular-nums', ...style }}>
      {isNeg ? `(${formatted})` : formatted}
    </span>
  );
}
