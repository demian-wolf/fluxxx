import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className, ...rest }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn("input appearance-none pr-9", className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-bg-raised">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      </div>
    );
  },
);
Select.displayName = "Select";
