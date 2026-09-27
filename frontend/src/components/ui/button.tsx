import { ButtonHTMLAttributes, forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { iconProps } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
};

/**
 * One main action per screen uses `primary`; frequent secondary actions use
 * `secondary`, rare ones `quiet`; `danger` is only for destructive actions.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      icon: Icon,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        className={[
          'ui-button',
          `ui-button-${variant}`,
          `ui-button-${size}`,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        ref={ref}
        type={type}
        {...props}
      >
        {Icon && <Icon {...iconProps} />}
        {children}
      </button>
    );
  },
);
