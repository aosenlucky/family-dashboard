import { fetchTravelWeather } from './travel-plan.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const pin = process.env.SYSTEM_PASSWORD
    if (pin && req.headers.authorization !== pin) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { destination, startDate, endDate } = req.body || {}
    if (!destination || !startDate || !endDate) {
      return res.status(400).json({ error: '目的地、开始日期和结束日期必填。' })
    }

    const weather = await fetchTravelWeather(destination, startDate, endDate)
    return res.status(200).json({ weather })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({
      error: '天气刷新失败。',
      detail: message
    })
  }
}
