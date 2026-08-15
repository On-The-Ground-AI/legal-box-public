// Chat.jsx — The main PII-protected chat interface
// Lawyers type questions here. All PII is stripped before reaching the AI.

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Shield, Bot, User, AlertCircle, Trash2 } from 'lucide-react'
import { api } from '../api'

// ── Single Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  if (isError) {
    return (
      <div className="flex gap-3 animate-fade-in">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle size={15} className="text-red-600" />
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-red-700 max-w-2xl">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-[#0A0A0A]' : 'bg-[#E05A1E]'
      }`}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#0A0A0A] text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
        }`}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* PII detected indicator */}
        {message.pii_detected && Object.keys(message.pii_detected).length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
            <Shield size={10} />
            PII anonymized before sending
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-[#E05A1E] flex items-center justify-center flex-shrink-0">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot text-gray-400" />
          <span className="typing-dot text-gray-400" />
          <span className="typing-dot text-gray-400" />
        </div>
        <p className="text-xs text-gray-400 mt-2">Local AI — typically 20–60 seconds</p>
      </div>
    </div>
  )
}

// ── Suggested Prompts (shown when chat is empty) ──────────────────────────────

const SUGGESTIONS = [
  "What are the key requirements for a valid contract under Singapore law?",
  "Summarise the main obligations of a landlord under a commercial lease",
  "What is the test for negligence in Singapore courts?",
  "Draft a letter of demand for unpaid invoices",
]

function EmptyState({ onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
      <div className="w-14 h-14 rounded-2xl bg-[#E05A1E] flex items-center justify-center mb-4">
        <Bot size={26} className="text-white" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Ask your legal AI assistant
      </h2>
      <p className="text-gray-500 text-sm mb-8 max-w-sm">
        All personal information is automatically stripped before your question reaches the AI.
        Nothing leaves your computer.
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestion(s)}
            className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#E05A1E] hover:bg-[#FEF3EE] transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Ollama Offline Warning ────────────────────────────────────────────────────

function OfflineWarning() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mx-6 mt-4 text-sm text-red-700 flex items-start gap-3">
      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
      <div>
        <strong>Ollama is not running.</strong>
        <p className="mt-1 text-red-600">
          Open Terminal and run: <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-xs">ollama serve</code>
          <br />
          Then make sure the model is downloaded:&nbsp;
          <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-xs">ollama pull gemma4:e4b</code>
        </p>
      </div>
    </div>
  )
}

// ── Main Chat Component ───────────────────────────────────────────────────────

export default function Chat({ health }) {
  const [messages, setMessages] = useState([])   // { role, content, pii_detected }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Pick up prompt prefill from Prompt Library "Open in Chat"
  useEffect(() => {
    const prefill = sessionStorage.getItem('chatPrefill')
    if (prefill) {
      sessionStorage.removeItem('chatPrefill')
      setInput(prefill)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    setInput('')
    const userMessage = { role: 'user', content: userText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Build conversation history for the API
      const apiMessages = newMessages.map(m => ({
        role: m.role === 'error' ? 'user' : m.role,
        content: m.content,
      }))

      const data = await api.chat({ messages: apiMessages })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        pii_detected: data.pii_detected,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Error: ${err.message}`,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
    // Shift+Enter adds a newline
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  const ollamaDown = health && !health.ollama_running

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="font-semibold text-gray-900">Legal Chat</h1>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Shield size={11} className="text-green-600" />
            PII protection active — client data stays private
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Ollama offline warning */}
      {ollamaDown && <OfflineWarning />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={(s) => { setInput(s); inputRef.current?.focus() }} />
        ) : (
          <div className="flex flex-col gap-5 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t bg-white px-6 py-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a legal question… (Shift+Enter for new line)"
              rows={1}
              disabled={loading || ollamaDown}
              className="w-full resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20
                         disabled:bg-gray-50 disabled:cursor-not-allowed
                         leading-relaxed max-h-40 overflow-y-auto"
              style={{ minHeight: '48px' }}
              onInput={e => {
                // Auto-resize textarea
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || ollamaDown}
            className="w-11 h-11 mt-0.5 rounded-xl bg-[#E05A1E] text-white flex items-center justify-center
                       hover:bg-[#C4481A] disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0 cursor-pointer"
            title="Send (Enter)"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-2 max-w-3xl mx-auto">
          Always review AI output with a qualified lawyer. Press Enter to send, Shift+Enter for new line.
        </p>
      </div>
    </div>
  )
}
