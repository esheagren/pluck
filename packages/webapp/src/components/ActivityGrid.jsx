import { useMemo, useState } from 'react'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

export default function ActivityGrid({ activityData = {} }) {
  const [tooltip, setTooltip] = useState(null)

  const { grid, monthLabels, maxCount } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the Sunday that starts the grid (53 weeks ago, adjusted to start on Sunday)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)
    // Adjust to previous Sunday
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
        const count = activityData[dateStr] || 0
        const isFuture = currentDate > today

        if (count > maxVal) maxVal = count

        week.push({
          date: dateStr,
          count,
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
  const dayLabelWidth = 28 // Width for day labels column

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-max">
        {/* Month labels */}
        <div className="relative h-4 mb-1" style={{ marginLeft: dayLabelWidth }}>
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
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] text-xs text-gray-400" style={{ width: dayLabelWidth }}>
            {DAYS_OF_WEEK.map((day, i) => (
              <div key={day} className="h-[10px] leading-[10px]" style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
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
                        setTooltip({
                          date: day.date,
                          count: day.count,
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
            {tooltip.count} {tooltip.count === 1 ? 'review' : 'reviews'}
          </div>
          <div className="text-gray-300">{formatDisplayDate(tooltip.date)}</div>
        </div>
      )}
    </div>
  )
}
