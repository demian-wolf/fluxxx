import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
};

export function Field({ label, hint, error, className, children }: FieldProps) {
  const generatedId = useId();
  const descriptionId = error || hint ? `${generatedId}-description` : undefined;
  let labelFor: string | undefined;
  let fieldChildren = children;

  if (isValidElement<FieldControlProps>(children)) {
    const controlId = children.props.id ?? generatedId;
    labelFor = controlId;

    fieldChildren = cloneElement(children, {
      id: controlId,
      "aria-describedby": [children.props["aria-describedby"], descriptionId]
        .filter(Boolean)
        .join(" ") || undefined,
    });
  }

  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={labelFor}>
          {label}
        </label>
      )}
      {fieldChildren}
      {error ? (
        <p id={descriptionId} className="mt-1 text-xs text-flux-red">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, ...rest }, ref) => {
    if (leading) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
            {leading}
          </span>
          <input ref={ref} className={cn("input pl-7", className)} {...rest} />
        </div>
      );
    }
    return <input ref={ref} className={cn("input", className)} {...rest} />;
  },
);
Input.displayName = "Input";
