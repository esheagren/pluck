import type { JSX } from 'react';
import type { UserAvatarProps } from '../types';

export default function UserAvatar({
  avatarUrl,
  displayName,
  username,
  email,
  size = 'md',
}: UserAvatarProps): JSX.Element {
  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  // Get initials from display name, username, or email
  const getInitials = (): string => {
    if (displayName) {
      const parts = displayName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return displayName[0].toUpperCase();
    }
    if (username) {
      return username[0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  // Generate a consistent color based on the name/username
  const getBackgroundColor = (): string => {
    const str = displayName || username || email || '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName || username || 'User avatar'}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${getBackgroundColor()} rounded-full flex items-center justify-center text-white font-medium`}
    >
      {getInitials()}
    </div>
  );
}
