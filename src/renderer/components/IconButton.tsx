import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "ghost" | "danger";
}

export default function IconButton({
  icon,
  label,
  variant = "ghost",
  className = "",
  ...props
}: IconButtonProps): ReactElement {
  return (
    <button className={`icon-button icon-button--${variant} ${className}`} title={props.title ?? label} {...props}>
      <span className="icon-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="icon-button__label">{label}</span>
    </button>
  );
}
