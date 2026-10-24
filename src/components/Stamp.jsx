export default function Stamp({ children, tone, rotate, size, className = "", ...rest }) {
  const cls = [
    "stamp",
    tone ? `stamp--${tone}` : "",
    rotate === "r" ? "stamp--rotate-r" : "",
    size ? `stamp--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
