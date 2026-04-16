export const ZONES = [
  // ── Grandes regiones ──────────────────────────────────────────────────────
  { name:'north_america',   label:'N. AMERICA',          lat:[15,72],  lon:[-170,-50], color:'rgba(0,200,255,0.05)',  border:'rgba(0,200,255,0.2)'  },
  { name:'europe',          label:'EUROPE',              lat:[35,72],  lon:[-25,45],   color:'rgba(0,200,255,0.05)',  border:'rgba(0,200,255,0.2)'  },
  { name:'china',           label:'CHINA / TAIWAN',      lat:[18,54],  lon:[73,135],   color:'rgba(0,200,255,0.05)',  border:'rgba(0,200,255,0.2)'  },

  // ── Zonas activas — rojo ──────────────────────────────────────────────────
  { name:'ukraine_black_sea', label:'UCRANIA / MAR NEGRO', lat:[44,53], lon:[22,40],  color:'rgba(255,80,0,0.08)',   border:'rgba(255,80,0,0.5)'   },
  { name:'levante',         label:'LEVANTE',             lat:[29,34],  lon:[34,38],   color:'rgba(255,59,74,0.09)',  border:'rgba(255,59,74,0.5)'  },
  { name:'gulf_ormuz',      label:'ORMUZ',               lat:[22,27],  lon:[51,60],   color:'rgba(255,59,74,0.09)',  border:'rgba(255,59,74,0.5)'  },
  { name:'iraq_syria',      label:'IRAQ / SIRIA',        lat:[29,38],  lon:[38,48],   color:'rgba(255,59,74,0.07)',  border:'rgba(255,59,74,0.4)'  },
  { name:'yemen',           label:'YEMEN',               lat:[12,19],  lon:[42,54],   color:'rgba(255,59,74,0.07)',  border:'rgba(255,59,74,0.4)'  },
  { name:'iran',            label:'IRÁN',                lat:[25,40],  lon:[44,64],   color:'rgba(255,59,74,0.07)',  border:'rgba(255,59,74,0.35)' },
  { name:'myanmar',         label:'MYANMAR',             lat:[10,28],  lon:[92,102],  color:'rgba(255,59,74,0.07)',  border:'rgba(255,59,74,0.35)' },

  // ── Zonas de tensión — ámbar ──────────────────────────────────────────────
  { name:'korea',           label:'COREA',               lat:[33,43],  lon:[124,132], color:'rgba(255,176,32,0.08)', border:'rgba(255,176,32,0.45)'},
  { name:'south_china_sea', label:'MAR CHINA SUR',       lat:[0,25],   lon:[105,125], color:'rgba(255,176,32,0.07)', border:'rgba(255,176,32,0.4)' },
  { name:'india_pakistan',  label:'INDIA / PAKISTÁN',    lat:[20,37],  lon:[60,80],   color:'rgba(255,176,32,0.07)', border:'rgba(255,176,32,0.4)' },
  { name:'south_caucasus',  label:'CÁUCASO SUR',         lat:[38,44],  lon:[38,51],   color:'rgba(255,176,32,0.07)', border:'rgba(255,176,32,0.38)'},
  { name:'sahel',           label:'SAHEL',               lat:[10,20],  lon:[-10,25],  color:'rgba(255,176,32,0.07)', border:'rgba(255,176,32,0.35)'},
  { name:'libya',           label:'LIBIA',               lat:[20,33],  lon:[9,25],    color:'rgba(255,176,32,0.07)', border:'rgba(255,176,32,0.35)'},

  // ── Zonas de vigilancia — azul ────────────────────────────────────────────
  { name:'baltic_sea',      label:'MAR BÁLTICO',         lat:[53,66],  lon:[9,30],    color:'rgba(0,200,255,0.06)',  border:'rgba(0,200,255,0.3)'  },
  { name:'somalia_horn',    label:'SOMALIA / CUERNO',    lat:[0,15],   lon:[38,52],   color:'rgba(0,200,255,0.06)',  border:'rgba(0,200,255,0.28)' },
  { name:'venezuela',       label:'VENEZUELA',           lat:[0,15],   lon:[-75,-58], color:'rgba(0,200,255,0.05)',  border:'rgba(0,200,255,0.25)' },
]

export const CHOKEPOINTS = [
  { label:'Gibraltar', lat:35.99, lon:-5.60  },
  { label:'Suez',      lat:30.46, lon:32.55  },
  { label:'Ormuz',     lat:26.59, lon:56.26  },
  { label:'Bab-el-M.', lat:12.58, lon:43.32  },
  { label:'Taiwan',    lat:24.50, lon:119.50 },
  { label:'Malacca',   lat: 2.50, lon:101.50 },
  { label:'Bósforo',   lat:41.12, lon:29.07  },
  { label:'Panamá',    lat: 9.08, lon:-79.68 },
]
