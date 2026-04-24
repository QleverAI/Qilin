import { useState, useRef, useCallback }                   from 'react'
import { View, Text, TextInput, Pressable, StyleSheet,
         FlatList, KeyboardAvoidingView, Platform,
         ActivityIndicator, SafeAreaView }                 from 'react-native'
import * as Haptics                                        from 'expo-haptics'
import { useLang }                                         from '../../hooks/useLanguage'
import { getToken }                                        from '../../hooks/apiClient'
import { PageHeader }                                      from '../../components/PageHeader'
import { C }                                               from '../../theme'
import { useBreakpoint }                                   from '../../theme/responsive'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export default function ChatScreen() {
  const { t } = useLang()
  const { hPad, maxContentWidth } = useBreakpoint()
  const listRef = useRef(null)

  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json().catch(() => ({}))
      const reply = res.ok ? (data.reply || '…') : t('chat.error')
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('chat.error') }])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [input, loading, messages, t])

  function handleClear() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setMessages([])
  }

  function renderItem({ item, index }) {
    const isUser = item.role === 'user'
    return (
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
        <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAssistant]}>
          {item.content}
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <PageHeader
        title={t('chat.title')}
        subtitle={messages.length > 0 ? undefined : undefined}
        right={messages.length > 0 ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text style={s.clearBtn}>{t('chat.clear')}</Text>
          </Pressable>
        ) : undefined}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.kav}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={[
            s.list,
            { paddingHorizontal: hPad, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth },
          ]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>◎</Text>
              <Text style={s.emptyText}>{t('chat.empty')}</Text>
            </View>
          }
          ListFooterComponent={
            loading ? (
              <View style={[s.bubble, s.bubbleAssistant, s.typingBubble]}>
                <ActivityIndicator size="small" color={C.cyan} />
              </View>
            ) : null
          }
        />

        <View style={[s.inputBar, { paddingHorizontal: hPad }]}>
          <TextInput
            style={s.textInput}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={C.txt3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg0 },
  kav:               { flex: 1 },
  list:              { paddingTop: 12, paddingBottom: 8, gap: 10 },
  emptyWrap:         { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:         { fontSize: 40, color: C.cyan },
  emptyText:         { fontSize: 15, color: C.txt3, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  bubble:            { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10,
                       borderRadius: 16, marginBottom: 2 },
  bubbleUser:        { alignSelf: 'flex-end', backgroundColor: C.blue,
                       borderBottomRightRadius: 4 },
  bubbleAssistant:   { alignSelf: 'flex-start', backgroundColor: C.bg1,
                       borderWidth: 1, borderColor: C.separator, borderBottomLeftRadius: 4 },
  bubbleText:        { fontSize: 15, lineHeight: 21 },
  bubbleTextUser:    { color: '#ffffff' },
  bubbleTextAssistant: { color: C.txt2 },
  typingBubble:      { paddingVertical: 12 },
  clearBtn:          { fontSize: 14, color: C.txt3 },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 10,
                       paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
                       borderTopColor: C.separator, backgroundColor: C.bg0 },
  textInput:         { flex: 1, backgroundColor: C.bg1, borderRadius: 20,
                       paddingHorizontal: 16, paddingVertical: 10,
                       fontSize: 16, color: '#ffffff', maxHeight: 120,
                       borderWidth: 1, borderColor: C.separator },
  sendBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue,
                       alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { backgroundColor: C.bg2 },
  sendIcon:          { fontSize: 16, color: '#ffffff' },
})
