export default function Barcode({ className = "", bars = 24 }) {
  return (
    <span className={`barcode ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
