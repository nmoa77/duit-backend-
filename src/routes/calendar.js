import { useEffect, useState } from "react"
import { getCalendarMonth } from "../../../services/calendar"
import { getAdminSubscriptions } from "../../../services/subscriptions"

export default function AdminCalendar() {

  const today = new Date()

  const [subscriptions, setSubscriptions] = useState([])
  const [subscriptionId, setSubscriptionId] = useState("")

  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const [data, setData] = useState({})

  // ======================
  // LOAD SUBSCRIPTIONS
  // ======================
  useEffect(() => {
    async function loadSubs() {
      const res = await getAdminSubscriptions()

      const list =
        res.data?.subscriptions ||
        res.data ||
        []

      setSubscriptions(list)

      if (list.length) {
        setSubscriptionId(list[0].id)
      }
    }

    loadSubs()
  }, [])

  // ======================
  // LOAD CALENDAR
  // ======================
  useEffect(() => {
    if (!subscriptionId) return

    async function loadCalendar() {
      const res = await getCalendarMonth({
        subscriptionId,
        month,
        year,
      })

      setData(res.data)
    }

    loadCalendar()
  }, [subscriptionId, month, year])

  // ======================
  // RENDER
  // ======================
  return (
    <div className="p-6 space-y-6">

      {/* TOPO */}
      <div className="flex gap-3 items-center flex-wrap">

        {/* SUBS */}
        <select
          value={subscriptionId}
          onChange={(e) => setSubscriptionId(e.target.value)}
          className="border border-zinc-200 rounded-xl px-3 py-2 text-sm"
        >
          {subscriptions.map(sub => (
            <option key={sub.id} value={sub.id}>
              {sub.client?.name} — {sub.mediaPlan?.title}
            </option>
          ))}
        </select>

        {/* MÊS */}
        <input
          type="number"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-zinc-200 rounded-xl px-3 py-2 w-20 text-sm"
        />

        {/* ANO */}
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-zinc-200 rounded-xl px-3 py-2 w-24 text-sm"
        />

      </div>

      {/* CALENDÁRIO */}
      <div className="space-y-3">

        {Object.keys(data).length === 0 && (
          <p className="text-sm text-zinc-400">
            Sem posts neste mês
          </p>
        )}

        {Object.entries(data).map(([date, posts]) => (
          <div
            key={date}
            className="border border-zinc-200 rounded-xl p-3 bg-white"
          >
            <p className="text-xs text-zinc-400 mb-2">
              {date}
            </p>

            {posts.map(post => (
              <div
                key={post.id}
                className="text-sm bg-zinc-100 px-3 py-2 rounded-lg"
              >
                {post.status}
              </div>
            ))}
          </div>
        ))}

      </div>

    </div>
  )
}