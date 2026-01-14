import { useAuth } from '../hooks/useAuth'
import { useActivityStats } from '../hooks/useActivityStats'
import ActivityGrid from '../components/ActivityGrid'

export default function ActivityPage() {
  const { user } = useAuth()
  const { activityData, loading, error } = useActivityStats(user?.id)

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <div className="animate-pulse">
            <div className="h-6 w-32 bg-gray-200 rounded mb-6" />
            <div className="h-[100px] bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Activity</h2>
          <p className="text-gray-500">Failed to load activity data. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Activity</h2>
        <ActivityGrid activityData={activityData} />
      </div>
    </div>
  )
}
