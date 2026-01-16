import type { JSX } from 'react';
import UserAvatar from './UserAvatar';
import type { ProfileHeaderProps } from '../types';

export default function ProfileHeader({
  profile,
  isEditable = false,
  onEditClick,
  size = 'lg',
}: ProfileHeaderProps): JSX.Element {
  const { username, displayName, bio, avatarUrl, email, memberSince, createdAt } = profile || {};

  const joinDate = memberSince || createdAt;
  const formattedJoinDate = joinDate
    ? new Date(joinDate).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex items-start gap-4">
      <UserAvatar
        avatarUrl={avatarUrl}
        displayName={displayName}
        username={username}
        email={email}
        size={size}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            {displayName && (
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {displayName}
              </h2>
            )}
            {username && (
              <p
                className={`text-gray-500 dark:text-gray-400 ${
                  displayName ? 'text-sm' : 'text-lg font-medium'
                }`}
              >
                @{username}
              </p>
            )}
            {!displayName && !username && email && (
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 truncate">
                {email}
              </p>
            )}
          </div>

          {isEditable && onEditClick && (
            <button
              onClick={onEditClick}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {bio && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{bio}</p>
        )}

        {formattedJoinDate && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Member since {formattedJoinDate}
          </p>
        )}
      </div>
    </div>
  );
}
