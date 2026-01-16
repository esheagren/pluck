import { useState, useEffect, useCallback, type JSX } from 'react';
import type { UsernameInputProps, UsernameAvailability } from '../types';

export default function UsernameInput({
  value,
  onChange,
  onCheckAvailability,
  currentUsername,
  disabled = false,
}: UsernameInputProps): JSX.Element {
  const [inputValue, setInputValue] = useState(value || '');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);
  const [touched, setTouched] = useState(false);

  // Debounced availability check
  useEffect(() => {
    if (!touched) return;

    const normalized = inputValue.toLowerCase().trim();

    // If same as current username, it's available
    if (currentUsername && normalized === currentUsername.toLowerCase()) {
      setAvailability({ available: true, reason: 'current' });
      return;
    }

    // If empty, clear availability
    if (!normalized) {
      setAvailability(null);
      return;
    }

    // Validate format locally first
    if (normalized.length < 3) {
      setAvailability({
        available: false,
        reason: 'too_short',
        message: 'Username must be at least 3 characters',
      });
      return;
    }

    if (normalized.length > 30) {
      setAvailability({
        available: false,
        reason: 'too_long',
        message: 'Username must be 30 characters or less',
      });
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
      if (!/^[a-z]/.test(normalized)) {
        setAvailability({
          available: false,
          reason: 'invalid_format',
          message: 'Username must start with a letter',
        });
      } else {
        setAvailability({
          available: false,
          reason: 'invalid_format',
          message: 'Only lowercase letters, numbers, and underscores allowed',
        });
      }
      return;
    }

    // Check availability via API
    setChecking(true);
    const timeoutId = setTimeout(async () => {
      if (onCheckAvailability) {
        const result = await onCheckAvailability(normalized);
        setAvailability(result as UsernameAvailability);
      }
      setChecking(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputValue, touched, currentUsername, onCheckAvailability]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setInputValue(newValue);
      setTouched(true);
      onChange?.(newValue);
    },
    [onChange]
  );

  const getStatusIcon = (): JSX.Element | null => {
    if (checking) {
      return (
        <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      );
    }

    if (!touched || !inputValue) return null;

    if (availability?.available) {
      return (
        <svg
          className="w-5 h-5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (availability && !availability.available) {
      return (
        <svg
          className="w-5 h-5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }

    return null;
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">Username</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder="username"
          maxLength={30}
          className={`w-full pl-8 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
            disabled ? 'bg-gray-50 text-gray-500' : 'bg-white'
          } ${
            touched && availability && !availability.available
              ? 'border-red-300'
              : touched && availability?.available
              ? 'border-green-300'
              : 'border-gray-300'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{getStatusIcon()}</div>
      </div>
      {touched && availability && !availability.available && availability.message && (
        <p className="text-sm text-red-500">{availability.message}</p>
      )}
      {touched && availability?.available && availability.reason !== 'current' && (
        <p className="text-sm text-green-500">Username is available</p>
      )}
    </div>
  );
}
