import { useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { fetchRelaySession } from '../lib/api'
import ChatSidebar from '../components/ChatSidebar'

export default function RelaySessionDetail() {
  const { chatId } = useParams()
  const [searchParams] = useSearchParams()
  const username = searchParams.get('username')
  const navigate = useNavigate()

  const fetchFn = useCallback(
    (id) => fetchRelaySession(id, username),
    [username]
  )

  const extraHeader = username ? (
    <span className="text-[11px] font-medium px-1.5 py-0.5 shrink-0" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
      {username}
    </span>
  ) : null

  return (
    <ChatSidebar
      chatId={chatId}
      onClose={() => navigate(-1)}
      fetchFn={fetchFn}
      username={username}
      extraHeader={extraHeader}
    />
  )
}
