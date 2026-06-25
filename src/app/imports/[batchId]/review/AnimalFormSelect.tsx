"use client";

import { useId, useState } from "react";
import { Select, type SelectOption } from "animal-island-ui";

type AnimalFormSelectProps = {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue: string;
  disabled?: boolean;
  placeholder?: string;
};

export function AnimalFormSelect({
  id,
  name,
  label,
  options,
  defaultValue,
  disabled = false,
  placeholder
}: AnimalFormSelectProps) {
  const labelId = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <span data-import-review-animal-select="true" className="block">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <input id={id} name={name} readOnly type="hidden" value={value} />
      <Select
        aria-labelledby={labelId}
        disabled={disabled}
        onChange={setValue}
        options={options}
        placeholder={placeholder}
        value={value}
      />
    </span>
  );
}
