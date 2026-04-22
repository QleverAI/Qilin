function bbox(zoneId, label, latMin, latMax, lonMin, lonMax) {
  return {
    type: 'Feature',
    properties: { zone_id: zoneId, label },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lonMin, latMin],
        [lonMax, latMin],
        [lonMax, latMax],
        [lonMin, latMax],
        [lonMin, latMin],
      ]],
    },
  }
}

export const SENTINEL_ZONES_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    bbox('north_america',    'América del Norte',              15, 72,  -170, -50),
    bbox('europe',           'Europa',                         35, 72,   -25,  45),
    bbox('china',            'China / Taiwan',                 18, 54,    73, 135),
    bbox('korea',            'Península de Corea',             33, 43,   124, 132),
    bbox('iran',             'Irán',                           25, 40,    44,  64),
    bbox('gulf_ormuz',       'Golfo Pérsico / Estrecho de Ormuz', 22, 27, 51,  60),
    bbox('iraq_syria',       'Iraq / Siria',                   29, 38,    38,  48),
    bbox('yemen',            'Yemen',                          12, 19,    42,  54),
    bbox('levante',          'Levante (Israel / Líbano / Gaza)', 29, 34,  34,  38),
    bbox('libya',            'Libia',                          20, 33,     9,  25),
    bbox('ukraine_black_sea','Ucrania / Mar Negro',            44, 53,    22,  40),
    bbox('baltic_sea',       'Mar Báltico',                    53, 66,     9,  30),
    bbox('south_caucasus',   'Cáucaso Sur',                    38, 44,    38,  51),
    bbox('india_pakistan',   'India / Pakistán',               20, 37,    60,  80),
    bbox('south_china_sea',  'Mar del Sur de China',            0, 25,   105, 125),
    bbox('sahel',            'Sahel',                          10, 20,   -10,  25),
    bbox('somalia_horn',     'Somalia / Cuerno de África',      0, 15,    38,  52),
    bbox('venezuela',        'Venezuela',                       0, 15,   -75, -58),
    bbox('myanmar',          'Myanmar',                        10, 28,    92, 102),
  ],
}

export const ZONE_LABELS = Object.fromEntries(
  SENTINEL_ZONES_GEOJSON.features.map(f => [f.properties.zone_id, f.properties.label])
)
