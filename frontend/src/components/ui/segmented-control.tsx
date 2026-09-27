import { useId } from 'react';

type Option<T extends string> = { value: T; label: string; count?: number };

/**
 * A choice among a few options. Native radios give arrow-key navigation and
 * form semantics; the group is named by `label`.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div aria-label={label} className="ui-segmented" role="radiogroup">
      {options.map((option) => (
        <label className="ui-segment" key={option.value}>
          <input
            checked={option.value === value}
            className="visually-hidden"
            name={name}
            onChange={() => onChange(option.value)}
            type="radio"
            value={option.value}
          />
          <span>
            {option.label}
            {option.count !== undefined && (
              // A flex item drops a leading plain space; keep a no-break one.
              <span className="numeric">
                {' · '}
                {option.count}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
