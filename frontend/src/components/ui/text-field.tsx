import { InputHTMLAttributes, useId } from 'react';

/** A labelled input with an optional hint and error, both announced with it. */
export function TextField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(' ') || undefined
        }
        aria-invalid={error ? true : undefined}
        id={id}
        {...props}
      />
      {hint && (
        <p className="ui-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
