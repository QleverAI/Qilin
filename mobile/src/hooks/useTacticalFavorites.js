import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY_AC  = 'qilin_fav_aircraft'
const KEY_VES = 'qilin_fav_vessels'

export function useTacticalFavorites() {
  const [favAircraft, setFavAircraft] = useState(new Set())
  const [favVessels,  setFavVessels]  = useState(new Set())

  useEffect(() => {
    AsyncStorage.multiGet([KEY_AC, KEY_VES]).then(([[, ac], [, ves]]) => {
      if (ac)  setFavAircraft(new Set(JSON.parse(ac)))
      if (ves) setFavVessels(new Set(JSON.parse(ves)))
    }).catch(() => {})
  }, [])

  const toggleAircraft = useCallback((icao24) => {
    setFavAircraft(prev => {
      const next = new Set(prev)
      next.has(icao24) ? next.delete(icao24) : next.add(icao24)
      AsyncStorage.setItem(KEY_AC, JSON.stringify([...next])).catch(() => {})
      return next
    })
  }, [])

  const toggleVessel = useCallback((mmsi) => {
    setFavVessels(prev => {
      const next = new Set(prev)
      next.has(mmsi) ? next.delete(mmsi) : next.add(mmsi)
      AsyncStorage.setItem(KEY_VES, JSON.stringify([...next])).catch(() => {})
      return next
    })
  }, [])

  return {
    favAircraft,
    favVessels,
    isFavAircraft: (icao24) => favAircraft.has(icao24),
    isFavVessel:   (mmsi)   => favVessels.has(mmsi),
    toggleAircraft,
    toggleVessel,
  }
}
