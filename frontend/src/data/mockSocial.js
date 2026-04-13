export const MOCK_POSTS = [
  {
    id: 1, platform: 'X', time: '14:38', zone: 'GULF ORMUZ',
    user: '@USNavy5thFleet', verified: true,
    text: 'USS Carney (DDG-64) conducted a freedom of navigation operation in international waters of the Strait of Hormuz. Vessels from the IRGCN approached in an unsafe and unprofessional manner.',
    sentiment: 'negative', engagements: 12400, relevance: 98,
    tags: ['IRGC','USNavy','Hormuz'],
  },
  {
    id: 2, platform: 'Telegram', time: '14:21', zone: 'GULF ORMUZ',
    user: 'IRGC Official Channel', verified: true,
    text: 'نیروی دریایی سپاه پاسداران ناوشکن آمریکایی را از آب‌های سرزمینی ایران در تنگه هرمز اخراج کرد.',
    sentiment: 'negative', engagements: 8900, relevance: 96,
    tags: ['IRGC','Iran','territorial'],
  },
  {
    id: 3, platform: 'X', time: '13:55', zone: 'TAIWAN STRAIT',
    user: '@MND_Taiwan', verified: true,
    text: '今日偵獲共機24架次進入我防空識別區，包括殲-16型16架次、轟-6型4架次。國軍已派遣兵力應對，廣播驅離。#ROCAF',
    sentiment: 'negative', engagements: 31200, relevance: 95,
    tags: ['PLAAF','Taiwan','ADIZ'],
  },
  {
    id: 4, platform: 'X', time: '13:12', zone: 'KOREA',
    user: '@ROK_JCS', verified: true,
    text: 'Our military detected the launch of 2 ballistic missiles from North Korea\'s Chagang Province at 10:48 KST. Missiles flew approximately 900km. Closely monitoring situation in coordination with US Forces Korea.',
    sentiment: 'negative', engagements: 18700, relevance: 94,
    tags: ['DPRK','missiles','ROK'],
  },
  {
    id: 5, platform: 'Telegram', time: '12:50', zone: 'YEMEN',
    user: 'Houthi Military Media', verified: false,
    text: 'القوات المسلحة اليمنية تعلن توسيع نطاق العمليات البحرية ليشمل بحر العرب. سيتم استهداف جميع السفن المتوجهة إلى الموانئ الإسرائيلية.',
    sentiment: 'negative', engagements: 5600, relevance: 88,
    tags: ['Houthi','Arabia','marítimo'],
  },
  {
    id: 6, platform: 'X', time: '12:05', zone: 'MEDITERRANEAN',
    user: '@RASimakov_UA', verified: false,
    text: 'OSINT: Planet Labs imagery shows at least 5 Russian Black Sea Fleet vessels departed Tartus naval base in Syria within past 48h. Destination unknown. Likely repositioning due to port vulnerabilities.',
    sentiment: 'neutral', engagements: 22100, relevance: 85,
    tags: ['Rusia','Siria','Tartus','OSINT'],
  },
  {
    id: 7, platform: 'X', time: '11:33', zone: 'IRAN',
    user: '@GenervaClock', verified: false,
    text: 'BREAKING: Iran nuclear talks in Geneva suspended indefinitely. P5+1 source: Tehran insisting on right to enrich to 90%, which is weapons-grade territory. No new meeting scheduled.',
    sentiment: 'negative', engagements: 45600, relevance: 82,
    tags: ['Iran','nuclear','Ginebra'],
  },
  {
    id: 8, platform: 'X', time: '10:58', zone: 'LEVANTE',
    user: '@IDF', verified: true,
    text: 'IAF concluded a week of unannounced air defense drills in northern Israel involving F-35I squadrons and Arrow-3 interceptors. Readiness levels remain at highest posture.',
    sentiment: 'neutral', engagements: 9800, relevance: 74,
    tags: ['IDF','IAF','F35','Arrow3'],
  },
  {
    id: 9, platform: 'Telegram', time: '10:22', zone: 'EUROPE',
    user: 'Baltic Defense Monitor', verified: false,
    text: 'NATO enhanced air policing scramble over Estonia this morning. Unknown drone violated Estonian airspace near Narva. F/A-18 from Finnish AF intercepted. Drone origin: TBC.',
    sentiment: 'negative', engagements: 7300, relevance: 70,
    tags: ['OTAN','Estonia','dron'],
  },
]

export const TRENDING_TOPICS = [
  { topic: '#HormuzIncident',  zone: 'GULF ORMUZ',    count: 84200, delta: '+340%' },
  { topic: '#TaiwanStrait',    zone: 'TAIWAN STRAIT', count: 61800, delta: '+180%' },
  { topic: '#DPRK',            zone: 'KOREA',         count: 38400, delta: '+95%'  },
  { topic: '#RedSea',          zone: 'YEMEN',         count: 27100, delta: '+62%'  },
  { topic: '#IranNuclear',     zone: 'IRAN',          count: 19600, delta: '+44%'  },
  { topic: '#TartusEvacuation',zone: 'MEDITERRANEAN', count: 14200, delta: '+210%' },
]

export const PLATFORM_COLORS = {
  'X':        '#e7e9ea',
  'Telegram': '#2aabee',
  'Reddit':   '#ff4500',
  'Facebook': '#1877f2',
}
