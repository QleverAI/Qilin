import { ZONES } from './zones'

const rand     = (min, max) => min + Math.random() * (max - min)
const randItem = arr => arr[Math.floor(Math.random() * arr.length)]

const CIVIL_CS  = ['IBE','VLG','RYR','EZY','AFR','BAW','DLH','AAL','UAL','DAL','SWR','KLM','TK','EK','QR']
const MIL_CS    = ['RCH','JAKE','MANTA','POSEI','JATO','TRTN','USAF','NAVY','DUKE','COPE','IRON']
const SHIP_NAMES = ['PACIFIC MARINER','ATLANTIC SPIRIT','GULF EAGLE','SEA PIONEER','OCEAN MASTER','IRON HAWK','LIBERTY STAR','NORTHERN STAR','SILVER DAWN','GOLDEN GATE']
const NAVAL_NAMES = ['USS GERALD R. FORD','USS NIMITZ','HMS PRINCE OF WALES','FNS CHARLES DE GAULLE','USS BAINBRIDGE','ARLEIGH BURKE','JS ATAGO']

export function generateAircraft() {
  const list = []

  // Civil traffic in major zones
  for (let i = 0; i < 40; i++) {
    const zone = randItem(ZONES.filter(z => ['north_america','europe','china'].includes(z.name)))
    list.push({
      id: 'A' + i,
      type: 'civil',
      callsign: randItem(CIVIL_CS) + (100 + Math.floor(Math.random() * 899)),
      lat: rand(zone.lat[0] + 2, zone.lat[1] - 2),
      lon: rand(zone.lon[0] + 2, zone.lon[1] - 2),
      heading: rand(0, 360),
      speed: Math.floor(rand(200, 550)),
      altitude: Math.floor(rand(8000, 12000)),
      zone: zone.name,
      vx: (Math.random() - .5) * 0.022,
      vy: (Math.random() - .5) * 0.012,
    })
  }

  // Military aircraft in hot zones
  const milPositions = [
    { lat:23.1, lon:58.6, zone:'gulf_ormuz' },
    { lat:23.4, lon:57.9, zone:'gulf_ormuz' },
    { lat:22.8, lon:59.1, zone:'gulf_ormuz' },
    { lat:29.5, lon:52.2, zone:'iran'       },
    { lat:31.0, lon:48.5, zone:'iraq_syria' },
    { lat:37.8, lon:127.0, zone:'korea'     },
    { lat:38.2, lon:126.4, zone:'korea'     },
    { lat:24.1, lon:119.8, zone:'china'     },
    { lat:23.6, lon:120.2, zone:'china'     },
  ]
  milPositions.forEach((p, i) => {
    list.push({
      id: 'M' + i,
      type: 'military',
      callsign: randItem(MIL_CS) + (10 + Math.floor(Math.random() * 89)),
      lat: p.lat + rand(-.3, .3),
      lon: p.lon + rand(-.3, .3),
      heading: rand(0, 360),
      speed: Math.floor(rand(400, 900)),
      altitude: Math.floor(rand(5000, 15000)),
      zone: p.zone,
      vx: (Math.random() - .5) * 0.015,
      vy: (Math.random() - .5) * 0.010,
    })
  })

  return list
}

export function generateVessels() {
  const list = []

  const shipZones = [
    { zone:'gulf_ormuz', lat:[22,27], lon:[51,60] },
    { zone:'levante',    lat:[31,36], lon:[28,36] },
    { zone:'europe',     lat:[37,46], lon:[-6,15] },
    { zone:'china',      lat:[20,30], lon:[110,125]},
  ]
  for (let i = 0; i < 22; i++) {
    const sz = randItem(shipZones)
    list.push({
      id: 'V' + i,
      type: Math.random() < .15 ? 'tanker' : 'cargo',
      name: randItem(SHIP_NAMES) + ' ' + (i + 1),
      lat: rand(sz.lat[0], sz.lat[1]),
      lon: rand(sz.lon[0], sz.lon[1]),
      heading: rand(0, 360),
      speed: Math.floor(rand(8, 22)),
      zone: sz.zone,
      vx: (Math.random() - .5) * 0.006,
      vy: (Math.random() - .5) * 0.004,
    })
  }

  // Naval military
  const navalPositions = [
    { lat:35.9,  lon:-5.7,   zone:'europe'     },
    { lat:25.5,  lon:55.2,   zone:'gulf_ormuz' },
    { lat:37.5,  lon:24.8,   zone:'europe'     },
    { lat:24.3,  lon:119.6,  zone:'china'      },
  ]
  navalPositions.forEach((p, i) => {
    list.push({
      id: 'N' + i,
      type: 'military',
      name: NAVAL_NAMES[i % NAVAL_NAMES.length],
      lat: p.lat, lon: p.lon,
      heading: rand(0, 360),
      speed: Math.floor(rand(10, 28)),
      zone: p.zone,
      vx: (Math.random() - .5) * 0.005,
      vy: (Math.random() - .5) * 0.004,
    })
  })

  return list
}

export const MOCK_ALERTS = [
  {
    id: 1, severity: 'high', zone: 'GULF ORMUZ',
    rule: 'asw_patrol_activity',
    title: 'Actividad ASW — Golfo de Omán',
    desc: '3× P-8 Poseidon + grupo de combate USS Gerald R. Ford. Posible actividad submarina.',
    time: '14:32',
    lat: 23.5, lon: 58.2,
  },
  {
    id: 2, severity: 'high', zone: 'TAIWAN STRAIT',
    rule: 'naval_group_detected',
    title: 'Grupo naval — Estrecho de Taiwán',
    desc: '4 buques PLAN tipo 052D en formación. Ejercicios navales no anunciados.',
    time: '13:58',
    lat: 24.2, lon: 119.9,
  },
  {
    id: 3, severity: 'medium', zone: 'ORMUZ',
    rule: 'ais_dark_vessel',
    title: 'AIS desactivado — Estrecho de Ormuz',
    desc: 'Petrolero MMSI:636018261 perdido en radar. Última pos: 26.4°N 56.8°E.',
    time: '12:14',
    lat: 26.4, lon: 56.8,
  },
  {
    id: 4, severity: 'medium', zone: 'KOREA',
    rule: 'military_aircraft_surge',
    title: 'Concentración aérea militar — Corea',
    desc: '+180% aeronaves militares vs media 7d. Posibles ejercicios DPRK o respuesta ROK.',
    time: '11:47',
    lat: 37.8, lon: 127.2,
  },
  {
    id: 5, severity: 'low', zone: 'MEDITERRANEAN',
    rule: 'unusual_routing',
    title: 'Ruta inusual — Mediterráneo Oriental',
    desc: '3 cargueros con destino declarado incoherente con ruta real. Monitorización activa.',
    time: '10:03',
    lat: 34.0, lon: 26.0,
  },
]
