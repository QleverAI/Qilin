import { Tabs }        from 'expo-router'
import { Text, View }  from 'react-native'
import { C }           from '../../theme'

const TABS = [
  { name:'index',     label:'INICIO',      icon:'◉' },
  { name:'tactical',  label:'TÁCTICO',     icon:'◎' },
  { name:'news',      label:'NOTICIAS',    icon:'◈' },
  { name:'documents', label:'DOCUMENTOS',  icon:'▣' },
  { name:'social',    label:'SOCIAL',      icon:'◈' },
]

function TabIcon({ icon, label, focused }) {
  const color = focused ? C.cyan : C.txt3
  return (
    <View style={{ alignItems:'center', gap:2, paddingTop:6 }}>
      <Text style={{ fontSize:14, color }}>{icon}</Text>
      <Text style={{ fontSize:7, letterSpacing:1, color, fontFamily:'SpaceMono' }}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarStyle: {
          backgroundColor:  C.bg1,
          borderTopColor:   C.borderMd,
          borderTopWidth:   1,
          height:           60,
          paddingBottom:    0,
        },
        tabBarShowLabel:    false,
        tabBarActiveTintColor:   C.cyan,
        tabBarInactiveTintColor: C.txt3,
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={t.icon} label={t.label} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
