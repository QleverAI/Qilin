/**
 * Bounding boxes de zonas monitorizadas por Sentinel — mismas que
 * frontend/src/data/sentinelZones.js, adaptadas a react-native-maps
 * (Polygon espera `[{latitude, longitude}, ...]`).
 */

function bbox(zoneId, label, latMin, latMax, lonMin, lonMax) {
  return {
    zone_id: zoneId,
    label,
    center: { latitude: (latMin + latMax) / 2, longitude: (lonMin + lonMax) / 2 },
    coordinates: [
      { latitude: latMin, longitude: lonMin },
      { latitude: latMin, longitude: lonMax },
      { latitude: latMax, longitude: lonMax },
      { latitude: latMax, longitude: lonMin },
    ],
  }
}

export const SENTINEL_ZONES = [
  bbox('north_america',    'América del Norte',               15, 72, -170, -50),
  bbox('europe',           'Europa',                          35, 72,  -25,  45),
  bbox('china',            'China / Taiwan',                  18, 54,   73, 135),
  bbox('korea',            'Península de Corea',              33, 43,  124, 132),
  bbox('iran',             'Irán',                            25, 40,   44,  64),
  bbox('gulf_ormuz',       'Golfo Pérsico / Ormuz',           22, 27,   51,  60),
  bbox('iraq_syria',       'Iraq / Siria',                    29, 38,   38,  48),
  bbox('yemen',            'Yemen',                           12, 19,   42,  54),
  bbox('levante',          'Levante',                         29, 34,   34,  38),
  bbox('libya',            'Libia',                           20, 33,    9,  25),
  bbox('ukraine_black_sea','Ucrania / Mar Negro',             44, 53,   22,  40),
  bbox('baltic_sea',       'Mar Báltico',                     53, 66,    9,  30),
  bbox('south_caucasus',   'Cáucaso Sur',                     38, 44,   38,  51),
  bbox('india_pakistan',   'India / Pakistán',                20, 37,   60,  80),
  bbox('south_china_sea',  'Mar del Sur de China',             0, 25,  105, 125),
  bbox('sahel',            'Sahel',                           10, 20,  -10,  25),
  bbox('somalia_horn',     'Somalia / Cuerno de África',       0, 15,   38,  52),
  bbox('venezuela',        'Venezuela',                        0, 15,  -75, -58),
  bbox('myanmar',          'Myanmar',                         10, 28,   92, 102),
]

export const ZONE_BY_ID = Object.fromEntries(SENTINEL_ZONES.map(z => [z.zone_id, z]))

/** Color por ratio de anomalía (NO₂ o SO₂). Alineado con la paleta web. */
export function ratioColor(ratio) {
  if (ratio == null)  return '#1f2a35'
  if (ratio < 1.0)    return '#166534'
  if (ratio < 1.5)    return '#854d0e'
  if (ratio < 2.0)    return '#9a3412'
  return '#991b1b'
}

export function ratioBadge(ratio) {
  if (ratio == null)  return { label: 'SIN DATOS', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
  if (ratio >= 2.0)   return { label: 'SEVERO',    color: '#991b1b', bg: 'rgba(153,27,27,0.18)' }
  if (ratio >= 1.5)   return { label: 'ANOMALÍA',  color: '#9a3412', bg: 'rgba(154,52,18,0.18)' }
  if (ratio >= 1.0)   return { label: 'ELEVADO',   color: '#854d0e', bg: 'rgba(133,77,14,0.18)' }
  return              { label: 'NORMAL',    color: '#166534', bg: 'rgba(22,101,52,0.18)' }
}
