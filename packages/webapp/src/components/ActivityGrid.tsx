import { useMemo, useState, type JSX } from 'react';
import type { ActivityGridProps, GridCell, MonthLabel, Tooltip, ActivityMetric } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getColorForCount(count: number, maxCount: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (maxCount === 0) return 'bg-gray-100 dark:bg-gray-800';

  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'bg-gray-300 dark:bg-gray-600';
  if (ratio <= 0.5) return 'bg-gray-500 dark:bg-gray-500';
  if (ratio <= 0.75) return 'bg-gray-700 dark:bg-gray-400';
  return 'bg-gray-900 dark:bg-gray-200';
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Helper to get count for a specific metric or total
function getCountForMetric(
  dayData: { reviews: number; cardsCreated: number } | number | undefined | null,
  metric: ActivityMetric | undefined
): number {
  if (dayData === undefined || dayData === null) return 0;

  // New format: { reviews: N, cardsCreated: M }
  if (typeof dayData === 'object') {
    if (metric === 'reviews') return dayData.reviews || 0;
    if (metric === 'cardsCreated') return dayData.cardsCreated || 0;
    // No metric specified - return total
    return (dayData.reviews || 0) + (dayData.cardsCreated || 0);
  }

  // Old format: just a number (reviews only)
  if (metric === 'cardsCreated') return 0;
  return dayData;
}

// metric: 'reviews' | 'cardsCreated' | undefined (undefined = combined)
// showLegend: whether to show the Less/More legend (default true)
// startDate: optional override for the grid start date (for aligning multiple grids)
export default function ActivityGrid({
  activityData = {},
  metric,
  showLegend = true,
  startDate: startDateOverride,
}: ActivityGridProps): JSX.Element {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { grid, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;

    if (startDateOverride) {
      // Use the provided start date override
      startDate = new Date(startDateOverride);
    } else {
      // Find the earliest date with activity for this metric
      const activityDates = Object.keys(activityData)
        .filter((date) => getCountForMetric(activityData[date], metric) > 0)
        .sort();

      if (activityDates.length > 0) {
        // Start from the first activity date
        const [year, month, day] = activityDates[0].split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // No activity yet - show just the current month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }
    }

    // Adjust to previous Sunday to align the grid
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Build the grid (columns = weeks, rows = days of week)
    const weeks: GridCell[][] = [];
    const labels: MonthLabel[] = [];
    const currentDate = new Date(startDate);
    let maxVal = 0;

    // Track which months we've seen for labels
    let lastMonth = -1;
    let lastLabelWeekIndex = -4; // Start negative so first label always shows

    while (currentDate <= today) {
      const week: GridCell[] = [];
      const weekStartMonth = currentDate.getMonth();

      // Add month label if this is a new month and there's enough space from the previous label
      // Minimum 3 weeks apart to prevent overlap (labels are ~25-30px, cellStep is 13px)
      if (weekStartMonth !== lastMonth && weeks.length - lastLabelWeekIndex >= 3) {
        labels.push({
          month: MONTHS[weekStartMonth],
          weekIndex: weeks.length,
        });
        lastMonth = weekStartMonth;
        lastLabelWeekIndex = weeks.length;
      } else if (weekStartMonth !== lastMonth) {
        lastMonth = weekStartMonth;
      }

      for (let day = 0; day < 7; day++) {
        const dateStr = formatDate(currentDate);
        const dayData = activityData[dateStr];
        const count = getCountForMetric(dayData, metric);
        const isFuture = currentDate > today;

        if (count > maxVal) maxVal = count;

        week.push({
          date: dateStr,
          count,
          isFuture,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(week);
    }

    return { grid: weeks, monthLabels: labels, maxCount: maxVal };
  }, [activityData, metric, startDateOverride]);

  // Calculate cell dimensions
  const cellSize = 10;
  const cellGap = 3;
  const cellStep = cellSize + cellGap; // 13px per week column

  // Tooltip label based on metric
  const getTooltipLabel = (count: number): string => {
    if (count === 0) return 'No activity';
    if (metric === 'reviews') {
      return `${count} ${count === 1 ? 'review' : 'reviews'}`;
    }
    if (metric === 'cardsCreated') {
      return `${count} ${count === 1 ? 'card' : 'cards'} added`;
    }
    // Combined
    return `${count} ${count === 1 ? 'action' : 'actions'}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-max">
        {/* Month labels */}
        <div className="relative h-4 mb-1">
          {monthLabels.map((label, i) => (
            <div
              key={i}
              className="absolute text-xs text-gray-400 dark:text-gray-500"
              style={{ left: label.weekIndex * cellStep }}
            >
              {label.month}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {grid.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`w-[10px] h-[10px] rounded-sm ${
                    day.isFuture ? 'bg-transparent' : getColorForCount(day.count, maxCount)
                  } cursor-pointer transition-all hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500`}
                  onMouseEnter={(e) => {
                    if (!day.isFuture) {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        date: day.date,
                        count: day.count,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex items-center justify-end gap-1 mt-3 text-xs text-gray-400 dark:text-gray-500">
            <span>Less</span>
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-100 dark:bg-gray-800" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-300 dark:bg-gray-600" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-500 dark:bg-gray-500" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-700 dark:bg-gray-400" />
            <div className="w-[10px] h-[10px] rounded-sm bg-gray-900 dark:bg-gray-200" />
            <span>More</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-200 dark:text-gray-900 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-medium">{getTooltipLabel(tooltip.count)}</div>
          <div className="text-gray-300 dark:text-gray-600">{formatDisplayDate(tooltip.date)}</div>
        </div>
      )}
    </div>
  );
}
