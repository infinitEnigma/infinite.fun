interface Props {
  text: string;
  children: React.ReactNode;
}

/** Lightweight CSS-only tooltip. Wraps any inline element. */
export function Tooltip({ text, children }: Props) {
  return (
    <span className="tooltip-wrap cursor-help">
      {children}
      <span className="tooltip-box">{text}</span>
    </span>
  );
}
