import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { MessageCircle, X, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { 
  evaluateProactiveTriggers, 
  getShownTriggersKey,
  type TriggerContext 
} from '@/lib/proactive-triggers';
import { actionsRapides, typePage, type TypePage } from '@/lib/assistant/context';
import { estServiceNonConfigure } from "@/lib/serviceNonConfigure";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'proactive';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  query?: string;
  action?: string;
}

// Welcome message will be generated dynamically with translations
function getWelcomeMessage(t: (key: string, fallback: string) => string): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: t('assistant.welcomeMessage', '👋 Hello! I am your expert TCO assistant. Ask me your questions about fleet electrification, subsidies, or how to use H2Fleet.'),
    timestamp: new Date(),
  };
}

// Type de page et actions rapides : module PUR src/lib/assistant/context.ts (D3)
function getContextualActions(pageType: TypePage, t: (key: string) => string): QuickAction[] {
  return actionsRapides(pageType).map((a) => ({
    id: a.id,
    icon: a.icon,
    label: t(`assistant.quick.${a.cle}.label`),
    query: t(`assistant.quick.${a.cle}.query`),
  }));
}

// Simple Markdown renderer for assistant messages
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  
  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} className={cn(
          "my-2 space-y-1",
          listType === 'ul' ? "list-disc list-inside" : "list-decimal list-inside"
        )}>
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{renderInline(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };
  
  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      flushList();
      continue;
    }
    
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="font-semibold text-sm mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="font-bold text-sm mt-3 mb-2">
          {renderInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    
    if (line === '---') {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-2 border-border" />);
      continue;
    }
    
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(line.slice(2));
      continue;
    }
    
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(orderedMatch[1]);
      continue;
    }
    
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-sm my-1">
        {renderInline(line)}
      </p>
    );
  }
  
  flushList();
  
  return <div className="space-y-1">{elements}</div>;
}

// LocalStorage keys
const getStorageKey = (userId?: string) => `assistant_messages_${userId || 'anonymous'}`;

export function AssistantWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [getWelcomeMessage(t)]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shownTriggerIds, setShownTriggerIds] = useState<Set<string>>(new Set());
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [hasProjects, setHasProjects] = useState<boolean | undefined>(undefined);
  const [hasFleet, setHasFleet] = useState<boolean | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pageEnteredAt = useRef<number>(Date.now());
  
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const pageType = typePage(location.pathname);
  const quickActions = getContextualActions(pageType, t);

  // Load messages and shown triggers from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(getStorageKey(user.id));
        if (stored) {
          const parsed = JSON.parse(stored) as Message[];
          const messagesWithDates = parsed.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(messagesWithDates.length > 0 ? messagesWithDates : [getWelcomeMessage(t)]);
        }
        
        const triggersStored = localStorage.getItem(getShownTriggersKey(user.id));
        if (triggersStored) {
          setShownTriggerIds(new Set(JSON.parse(triggersStored)));
        }
      } catch (e) {
        console.error('Failed to load assistant data from localStorage:', e);
      }
    }
  }, [user?.id]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (user?.id && messages.length > 0) {
      try {
        localStorage.setItem(getStorageKey(user.id), JSON.stringify(messages));
      } catch (e) {
        console.error('Failed to save assistant messages to localStorage:', e);
      }
    }
  }, [messages, user?.id]);

  // Save shown triggers to localStorage
  useEffect(() => {
    if (user?.id && shownTriggerIds.size > 0) {
      try {
        localStorage.setItem(
          getShownTriggersKey(user.id), 
          JSON.stringify(Array.from(shownTriggerIds))
        );
      } catch (e) {
        console.error('Failed to save shown triggers to localStorage:', e);
      }
    }
  }, [shownTriggerIds, user?.id]);

  // Reset time on page when route changes
  useEffect(() => {
    pageEnteredAt.current = Date.now();
    setTimeOnPage(0);
  }, [location.pathname]);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOnPage(Math.floor((Date.now() - pageEnteredAt.current) / 1000));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Contexte : projets et flotte de l’utilisateur
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .then(({ data }) => {
          setHasProjects(data && data.length > 0);
        });
      
      supabase
        .from('vehicles')
        .select('id')
        .limit(1)
        .then(({ data }) => {
          setHasFleet(!!data && data.length > 0);
        });
    }
  }, [user?.id]);

  // Evaluate proactive triggers
  const checkProactiveTriggers = useCallback(() => {
    if (!isOpen) return;
    
    const context: TriggerContext = {
      page_type: pageType,
      current_url: location.pathname,
      user_id: user?.id,
      is_new_user: hasProjects === false,
      time_on_page: timeOnPage,
      has_projects: hasProjects,
      has_fleet: hasFleet,
    };

    const trigger = evaluateProactiveTriggers(context, shownTriggerIds);
    
    if (trigger) {
      const alreadyShown = messages.some(m => 
        m.role === 'proactive' && m.content === t(trigger.messageKey)
      );
      
      if (!alreadyShown) {
        const proactiveMessage: Message = {
          id: `proactive-${trigger.id}-${Date.now()}`,
          role: 'proactive',
          content: t(trigger.messageKey),
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, proactiveMessage]);
        setShownTriggerIds(prev => new Set([...prev, trigger.id]));
      }
    }
  }, [isOpen, location.pathname, user?.id, hasProjects, hasFleet, timeOnPage, shownTriggerIds, messages, pageType]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      checkProactiveTriggers();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [checkProactiveTriggers]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build conversation history for API (last 10 messages, excluding welcome and proactive)
  const buildConversationHistory = useCallback(() => {
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));
  }, [messages]);

  // Send message with streaming support
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const history = buildConversationHistory();

      // La fonction exige le JWT de l'utilisateur (plus la clé anon seule).
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          context: {
            current_url: location.pathname,
            page_type: pageType,
            time_on_page: timeOnPage,
            has_projects: hasProjects,
            has_fleet: hasFleet,
          },
        }),
      });

      if (await estServiceNonConfigure(response)) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: t('assistant.notConfigured') } : m
        ));
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      
      // Handle streaming response
      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');
        
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ));
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }

        // Ensure final content is set
        if (fullContent) {
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { ...m, content: fullContent } : m
          ));
        }
      } else {
        // Handle non-streaming response (fallback)
        const data = await response.json();
        const content = data.response || t('assistant.noResponse', "Sorry, I couldn't generate a response.");
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content } : m
        ));
      }
    } catch (error) {
      console.error('Assistant error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: t('assistant.error', '⚠️ Temporary error. Please try again.') } 
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(inputValue);

  const handleQuickAction = (action: QuickAction) => {
    if (action.action?.startsWith('navigate:')) {
      const path = action.action.replace('navigate:', '');
      navigate(path);
      setIsOpen(false);
    } else if (action.query) {
      sendMessage(action.query);
    }
  };

  const handleClearHistory = () => {
    setMessages([getWelcomeMessage(t)]);
    setShownTriggerIds(new Set());
    if (user?.id) {
      localStorage.removeItem(getStorageKey(user.id));
      localStorage.removeItem(getShownTriggersKey(user.id));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-[60px] h-[60px] rounded-full',
          'bg-primary text-primary-foreground shadow-2xl',
          'flex items-center justify-center',
          'hover:scale-105 active:scale-95 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isOpen && 'hidden'
        )}
        aria-label={t('assistant.openAssistant', 'Open assistant')}
      >
        <MessageCircle className="w-7 h-7" />
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          'fixed z-50 bg-background border border-border rounded-xl shadow-2xl',
          'flex flex-col overflow-hidden',
          'transition-all duration-300 ease-out',
          'bottom-6 right-6 w-[400px] h-[600px]',
          'max-md:inset-0 max-md:w-full max-md:h-full max-md:rounded-none max-md:bottom-0 max-md:right-0',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              🤖 {t('assistant.title', 'Expert TCO Assistant')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('assistant.subtitle', 'Your technical and strategic guide')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearHistory}
              className="h-8 w-8"
              aria-label={t('assistant.clearHistory', 'Clear history')}
              title={t('assistant.clearHistory', 'Clear history')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
              aria-label={t('common.close', 'Close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground text-sm'
                    : message.role === 'proactive'
                    ? 'bg-accent/50 text-foreground border border-accent'
                    : 'bg-muted text-foreground'
                )}
              >
                {message.role === 'user' ? message.content : (
                  message.content ? renderMarkdown(message.content) : (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator - only show when loading and last message has content */}
          {isLoading && messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {quickActions.length > 0 && !isLoading && (
          <div className="flex gap-2 flex-wrap px-4 py-2 border-t border-border bg-muted/30">
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="text-xs px-2 py-1.5 bg-background hover:bg-accent/50 border border-border rounded-md flex items-center gap-1 transition-colors"
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-background">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('assistant.placeholder', 'Ask your question...')}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              aria-label={t('common.send', 'Send')}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
