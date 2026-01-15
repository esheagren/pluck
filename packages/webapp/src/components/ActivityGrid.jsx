import { useMemo, useState } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getColorForCount(count, maxCount) {
  if (count === 0) return 'bg-gray-100'
  if (maxCount === 0) return 'bg-gray-100'

  const ratio = count / maxCount
  if (ratio <= 0.25) return 'bg-gray-300'
  if (ratio <= 0.5) return 'bg-gray-500'
  if (ratio <= 0.75) return 'bg-gray-700'
  return 'bg-gray-900'
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Helper to get total activity count from either old or new data format
function getTotalCount(dayData) {
  if (dayData === undefined || dayData === null) return 0
  // New format: { reviews: N, cardsCreated: M }
  if (typeof dayData === 'object') {
    return (dayData.reviews || 0) + (dayData.cardsCreated || 0)
  }
  // Old format: just a number (reviews only)
  return dayData
}

// Helper to get individual counts
function getActivityCounts(dayData) {
  if (dayData === undefined || dayData === null) {
    return { reviews: 0, cardsCreated: 0 }
  }
  if (typeof dayData === 'object') {
    return {
      reviews: dayData.reviews || 0,
      cardsCreated: dayData.cardsCreated || 0
    }
  }
  // Old format: just reviews
  return { reviews: dayData, cardsCreated: 0 }
}

export default function ActivityGrid({ activityData = {} }) {
  const [tooltip, setTooltip] = useState(null)

  const { grid, monthLabels, maxCount } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the earliest date with activity
    const activityDates = Object.keys(activityData).sort()
    let startDate

    if (activityDates.length > 0) {
      // Start from the first activity date
      const [year, month, day] = activityDates[0].split('-')
      startDate = new Date(year, month - 1, day)
    } else {
      // No activity yet - show just the current month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    // Adjust to previous Sunday to align the grid
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)

    // Build the grid (columns = weeks, rows = days of week)
    const weeks = []
    const labels = []
    let currentDate = new Date(startDate)
    let maxVal = 0

    // Track which months we've seen for labels
    let lastMonth = -1

    while (currentDate <= today) {
      const week = []
      const weekStartMonth = currentDate.getMonth()

      // Add month label if this is a new month
      if (weekStartMonth !== lastMonth) {
        labels.push({
          month: MONTHS[weekStartMonth],
          weekIndex: weeks.length
        })
        lastMonth = weekStartMonth
      }

      for (let day = 0; day < 7; day++) {
        const dateStr = formatDate(currentDate)
        const dayData = activityData[dateStr]
        const totalCount = getTotalCount(dayData)
        const isFuture = currentDate > today

        if (totalCount > maxVal) maxVal = totalCount

        week.push({
          date: dateStr,
          count: totalCount,
          data: dayData,
          isFuture
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }

      weeks.push(week)
    }

    return { grid: weeks, monthLabels: labels, maxCount: maxVal }
  }, [activityData])

  // Calculate cell dimensions
  const cellSize = 10
  const cellGap = 3
  const cellStep = cellSize + cellGap // 13px per week column

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-max">
        {/* Month labels */}
        <div className="relative h-4 mb-1">
          {monthLabels.map((label, i) => (
            <div
              key={i}
              className="absolute text-xs text-gray-400"
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
                {week.map((day, dayIndex) => (
                  <div
                    key={day.date}
                    className={`w-[10px] h-[10px] rounded-sm ${
                      day.isFuture
                        ? 'bg-transparent'
                        : getColorForCount(day.count, maxCount)
                    } cursor-pointer transition-all hover:ring-1 hover:ring-gray-400`}
                    onMouseEnter={(e) => {
                      if (!day.isFuture) {
                        const rect = e.target.getBoundingClientRect()
                        const counts = getActivityCounts(day.data)
                        setTooltip({
                          date: day.date,
                          reviews: counts.reviews,
                          cardsCreated: counts.cardsCreated,
                          total: day.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8
                        })
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-3 text-xs text-gray-400">
          <span>Less</span>
          <div className="w-[10px] h-[10px] rounded-sm bg-gray-100" />
          <div className="w-[10px] h-[10px] rounded-sm bg-gray-300" />
          <div className="w-[10px] h-[10px] rounded-sm bg-gray-500" />
          <div className="w-[10px] h-[10px] rounded-sm bg-gray-700" />
          <div className="w-[10px] h-[10px] rounded-sm bg-gray-900" />
          <span>More</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-medium">
            {tooltip.reviews > 0 && (
              <span>{tooltip.reviews} {tooltip.reviews === 1 ? 'review' : 'reviews'}</span>
            )}
            {tooltip.reviews > 0 && tooltip.cardsCreated > 0 && <span>, </span>}
            {tooltip.cardsCreated > 0 && (
              <span>{tooltip.cardsCreated} {tooltip.cardsCreated === 1 ? 'card' : 'cards'} added</span>
            )}
            {tooltip.total === 0 && <span>No activity</span>}
          </div>
          <div className="text-gray-300">{formatDisplayDate(tooltip.date)}</div>
        </div>
      )}
    </div>
  )
}
