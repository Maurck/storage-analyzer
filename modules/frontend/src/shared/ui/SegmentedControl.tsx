import React from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number> {
  /** Groups the radio inputs; must be unique on the page. */
  name: string;
  legend: string;
  /** Show the legend next to the options instead of only to assistive technology. */
  showLegend?: boolean;
  value: T;
  options: SegmentedOption<T>[];
  onChange(value: T): void;
  disabled?: boolean;
  className?: string;
}

/** Native radio buttons styled as one control: arrow keys move between options. */
export function SegmentedControl<T extends string | number>({
  name,
  legend,
  showLegend = false,
  value,
  options,
  onChange,
  disabled,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <fieldset
      className={`sa-segmented ${className}`.trim()}
      disabled={disabled}
    >
      <legend className={showLegend ? "sa-segmented__legend" : "sa-sr-only"}>
        {legend}
      </legend>
      <div className="sa-segmented__options">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={`sa-segmented__option ${option.value === value ? "is-checked" : ""}`.trim()}
          >
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
