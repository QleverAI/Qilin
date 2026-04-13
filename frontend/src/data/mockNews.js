export const MOCK_NEWS = [
  {
    id: 1, severity: 'high', zone: 'GULF ORMUZ', source: 'Reuters', time: '14:41',
    title: 'IRGC intercepta destructor USS Carney en el estrecho de Ormuz',
    excerpt: 'Tres embarcaciones de patrulla rápida de la Guardia Revolucionaria han efectuado maniobras de interceptación a menos de 100 metros del destructor estadounidense. La US5thFleet confirma el incidente.',
    tags: ['naval','iran','eeuu'], relevance: 97,
  },
  {
    id: 2, severity: 'high', zone: 'TAIWAN STRAIT', source: 'SCMP', time: '13:58',
    title: 'PLAN despliega 24 aeronaves en ejercicios no anunciados frente a Taiwán',
    excerpt: 'El Ministerio de Defensa de Taiwán confirma que 24 aviones de guerra chinos, incluyendo cazas J-16 y bombarderos H-6, han cruzado la línea media del estrecho.',
    tags: ['china','taiwan','ejercicios'], relevance: 95,
  },
  {
    id: 3, severity: 'medium', zone: 'KOREA', source: 'Yonhap', time: '12:14',
    title: 'Corea del Norte lanza dos misiles balísticos hacia el Mar del Este',
    excerpt: 'El Estado Mayor Conjunto surcoreano informa del lanzamiento de dos misiles desde la provincia de Chagang. Los misiles habrían viajado aproximadamente 900 km antes de caer al mar.',
    tags: ['dprk','misiles','corea'], relevance: 94,
  },
  {
    id: 4, severity: 'medium', zone: 'MEDITERRANEAN', source: 'Al Monitor', time: '11:47',
    title: 'Buques de guerra rusos abandonan base naval de Tartus en Siria',
    excerpt: 'Imágenes satelitales de Planet Labs muestran que al menos cinco buques de la Flota del Mar Negro han abandonado la base naval rusa de Tartus en las últimas 48 horas.',
    tags: ['rusia','siria','naval'], relevance: 88,
  },
  {
    id: 5, severity: 'medium', zone: 'YEMEN', source: 'AP', time: '11:02',
    title: 'Houthis anuncian expansión de zona de operaciones al Mar Arábigo',
    excerpt: 'Un portavoz militar de los Houthi ha declarado que la zona de ataques se amplía para incluir todos los buques con destino a puertos israelíes, independientemente de su bandera.',
    tags: ['houthi','yemen','maritime'], relevance: 85,
  },
  {
    id: 6, severity: 'low', zone: 'LEVANTE', source: 'Haaretz', time: '10:33',
    title: 'Israel concluye maniobras de defensa aérea en el norte con participación de F-35',
    excerpt: 'Las Fuerzas Aéreas israelíes han completado una semana de ejercicios no programados con escuadrillas de F-35I Adir y sistemas Arrow-3 en el norte del país.',
    tags: ['israel','ejercicios','f35'], relevance: 72,
  },
  {
    id: 7, severity: 'low', zone: 'EUROPE', source: 'AFP', time: '09:55',
    title: 'OTAN activa vigilancia aérea adicional sobre el Báltico tras incidente con dron',
    excerpt: 'La Alianza Atlántica ha ordenado incrementar las patrullas de cazas sobre Estonia y Letonia después de que un dron de origen desconocido violara el espacio aéreo estonio.',
    tags: ['otan','baltico','dron'], relevance: 68,
  },
  {
    id: 8, severity: 'low', zone: 'IRAN', source: 'Iran International', time: '09:10',
    title: 'Negociaciones nucleares en Ginebra suspendidas sin acuerdo',
    excerpt: 'Las conversaciones entre los P5+1 e Irán se han interrumpido sin fecha para su reanudación. Fuentes diplomáticas apuntan a discrepancias sobre el nivel de enriquecimiento permitido.',
    tags: ['iran','nuclear','diplomacia'], relevance: 65,
  },
]

export const NEWS_SOURCES = ['Reuters', 'AP', 'AFP', 'SCMP', 'Yonhap', 'Al Monitor', 'Haaretz', 'Iran International', 'BBC', 'Al Jazeera']
