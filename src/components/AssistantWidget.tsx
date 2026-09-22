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

// Helper to determine page type from pathname
function getPageType(pathname: string): string {
  if (pathname.includes('/scenarios/new') || pathname.includes('/flexible')) return 'scenario_form';
  if (pathname.includes('/scenarios') && pathname.includes('/results')) return 'scenario_results';
  if (pathname.includes('/scenarios')) return 'scenarios_list';
  if (pathname.includes('/projects')) return 'projects';
  if (pathname.includes('/infrastructure')) return 'infrastructure';
  if (pathname.includes('/analytics')) return 'analytics';
  if (pathname.includes('/telematics')) return 'telematics';
  if (pathname.includes('/donnees-ref') || pathname.includes('/reference-data')) return 'reference_data';
  if (pathname.includes('/custom-data')) return 'custom_data';
  if (pathname.includes('/subsidies')) return 'subsidies';
  if (pathname.includes('/suppliers')) return 'suppliers';
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname === '/') return 'home';
  return 'unknown';
}

// Get contextual quick actions based on current page - with i18n
function getContextualActions(pageType: string, t: (key: string, fallback: string) => string): QuickAction[] {
  const actionsMap: Record<string, QuickAction[]> = {
    scenario_form: [
      { id: 'example', icon: '📋', label: t('assistant.actions.example', 'Example'), query: t('assistant.queries.scenarioExample', 'Show me a typical scenario example for a Class 8 truck fleet') },
      { id: 'h2-price', icon: '💰', label: t('assistant.actions.h2Price', 'H2 Price'), query: t('assistant.queries.h2Price', 'What hydrogen price should I use?') },
      { id: 'elec-price', icon: '⚡', label: t('assistant.actions.elecPrice', 'Elec Price'), query: t('assistant.queries.elecPrice', 'What are the electricity rates for fleets in Canada?') },
      { id: 'vehicles', icon: '🚛', label: t('assistant.actions.vehicles', 'Vehicles'), query: t('assistant.queries.availableVehicles', 'What hydrogen and electric vehicles are available in Canada?') },
      { id: 'subsidies', icon: '🇨🇦', label: t('assistant.actions.subsidies', 'Subsidies'), query: t('assistant.queries.subsidiesForTco', 'What subsidies can I include in my TCO calculation?') },
      { id: 'formula', icon: '📐', label: t('assistant.actions.tcoFormula', 'TCO Formula'), query: t('assistant.queries.tcoFormula', 'How is the TCO calculated exactly?') }
    ],
    scenario_results: [
      { id: 'explain', icon: '📈', label: t('assistant.actions.explain', 'Explain'), query: t('assistant.queries.explainResults', 'Explain these TCO results in simple terms') },
      { id: 'payback', icon: '📉', label: t('assistant.actions.payback', 'Payback'), query: t('assistant.queries.paybackPeriod', 'What is the typical payback period for a hydrogen fleet?') },
      { id: 'emissions', icon: '🌱', label: t('assistant.actions.emissions', 'Emissions'), query: t('assistant.queries.emissionsCalc', 'How are CO2 emissions calculated?') },
      { id: 'optimize', icon: '🔧', label: t('assistant.actions.optimize', 'Optimize'), query: t('assistant.queries.improveTco', 'How can I improve my TCO?') },
      { id: 'compare', icon: '⚖️', label: t('assistant.actions.compare', 'Compare'), query: t('assistant.queries.compareScenarios', 'How can I compare this scenario with others?') },
      { id: 'export', icon: '📄', label: t('assistant.actions.export', 'Export'), query: t('assistant.queries.exportResults', 'How can I export and share these results?') }
    ],
    scenarios_list: [
      { id: 'create', icon: '➕', label: t('assistant.actions.create', 'Create'), query: t('assistant.queries.createScenario', 'How do I create a new TCO scenario?') },
      { id: 'compare', icon: '⚖️', label: t('assistant.actions.compare', 'Compare'), query: t('assistant.queries.compareMultiple', 'How can I compare multiple scenarios?') },
      { id: 'analyze', icon: '📊', label: t('assistant.actions.analyze', 'Analyze'), query: t('assistant.queries.interpretResults', 'How do I interpret the results of my scenarios?') },
      { id: 'recommend', icon: '💡', label: t('assistant.actions.tips', 'Tips'), query: t('assistant.queries.techRecommendation', 'What technologies do you recommend for my fleet?') },
      { id: 'export', icon: '📤', label: t('assistant.actions.export', 'Export'), query: t('assistant.queries.exportScenarioResults', 'How can I export my scenario results?') }
    ],
    reference_data: [
      { id: 'how-to-use', icon: '❓', label: t('assistant.actions.use', 'Use'), query: t('assistant.queries.useReferenceData', 'How do I use this reference data in my scenarios?') },
      { id: 'sources', icon: '📚', label: t('assistant.actions.sources', 'Sources'), query: t('assistant.queries.dataSources', 'Where does this reference data come from?') },
      { id: 'update', icon: '🔄', label: t('assistant.actions.update', 'Update'), query: t('assistant.queries.dataUpdateFreq', 'How often is the data updated?') },
      { id: 'customize', icon: '✏️', label: t('assistant.actions.customize', 'Customize'), query: t('assistant.queries.modifyReference', 'Can I modify the reference values?') }
    ],
    custom_data: [
      { id: 'what-is', icon: '❓', label: t('assistant.actions.whatIs', 'What is it?'), query: t('assistant.queries.customDataPurpose', 'What is custom data used for?') },
      { id: 'import', icon: '📥', label: t('assistant.actions.import', 'Import'), query: t('assistant.queries.importData', 'How do I import my own reference data?') },
      { id: 'modify', icon: '✏️', label: t('assistant.actions.modify', 'Modify'), query: t('assistant.queries.modifyValue', 'How do I modify a reference value?') },
      { id: 'apply', icon: '🔗', label: t('assistant.actions.apply', 'Apply'), query: t('assistant.queries.applyCustomData', 'How do I apply my custom data to a scenario?') },
      { id: 'export', icon: '📤', label: t('assistant.actions.export', 'Export'), query: t('assistant.queries.exportCustomData', 'How can I export my custom data?') }
    ],
    dashboard: [
      { id: 'start', icon: '🚀', label: t('assistant.actions.start', 'Start'), query: t('assistant.queries.guideFirstProject', 'Guide me to create my first project and TCO scenario') },
      { id: 'create', icon: '➕', label: t('assistant.actions.createProject', 'Create project'), query: t('assistant.queries.createProject', 'How do I create a new project?') },
      { id: 'vehicle-types', icon: '🚛', label: t('assistant.actions.vehicles', 'Vehicles'), query: t('assistant.queries.supportedVehicles', 'What types of vehicles are supported by H2Fleet?') },
      { id: 'subsidies', icon: '💰', label: t('assistant.actions.subsidies', 'Subsidies'), query: t('assistant.queries.availableSubsidies', 'What subsidies are available in Canada?') },
      { id: 'demo', icon: '📊', label: t('assistant.actions.example', 'Example'), query: t('assistant.queries.completeExample', 'Show me a complete TCO scenario example') }
    ],
    infrastructure: [
      { id: 'h2-station', icon: '🔋', label: t('assistant.actions.h2Station', 'H2 Station'), query: t('assistant.queries.h2StationCost', 'How much does a hydrogen station cost?') },
      { id: 'ev-chargers', icon: '⚡', label: t('assistant.actions.evChargers', 'EV Chargers'), query: t('assistant.queries.chargerCosts', 'What are the costs of charging stations?') },
      { id: 'sizing', icon: '📍', label: t('assistant.actions.sizing', 'Sizing'), query: t('assistant.queries.sizingInfra', 'How do I size my charging infrastructure?') },
      { id: 'grid', icon: '🔌', label: t('assistant.actions.power', 'Power'), query: t('assistant.queries.gridPower', 'What electrical power should I plan for?') },
      { id: 'apply', icon: '🔗', label: t('assistant.actions.apply', 'Apply'), query: t('assistant.queries.applyInfraCosts', 'How do I apply these infrastructure costs to a scenario?') }
    ],
    subsidies: [
      { id: 'imhzev', icon: '🇨🇦', label: 'iMHZEV', query: t('assistant.queries.imhzevProgram', 'How does the iMHZEV program work?') },
      { id: 'ecocamionnage', icon: '🍁', label: t('assistant.actions.ecocamionnage', 'Écocamionnage'), query: t('assistant.queries.ecocamionnage', 'How does Écocamionnage Quebec work?') },
      { id: 'cumul', icon: '📋', label: t('assistant.actions.stack', 'Stack'), query: t('assistant.queries.stackSubsidies', 'Can I combine federal and provincial subsidies?') },
      { id: 'deadlines', icon: '📅', label: t('assistant.actions.dates', 'Dates'), query: t('assistant.queries.subsidyDeadlines', 'What are the deadlines to apply for subsidies?') },
      { id: 'max-amounts', icon: '💵', label: t('assistant.actions.amounts', 'Amounts'), query: t('assistant.queries.maxSubsidyAmounts', 'What are the maximum subsidy amounts per vehicle?') }
    ],
    analytics: [
      { id: 'kpis', icon: '📈', label: t('assistant.actions.keyKpis', 'Key KPIs'), query: t('assistant.queries.importantKpis', 'What are the most important KPIs to track?') },
      { id: 'sensitivity', icon: '📊', label: t('assistant.actions.sensitivity', 'Sensitivity'), query: t('assistant.queries.sensitivityAnalysis', 'What is sensitivity analysis?') },
      { id: 'roi', icon: '💰', label: 'ROI', query: t('assistant.queries.roiCalculation', 'How is the return on investment calculated?') },
      { id: 'scenarios-impact', icon: '🔄', label: t('assistant.actions.scenarios', 'Scenarios'), query: t('assistant.queries.scenariosImpact', 'How do different scenarios impact projections?') }
    ],
    telematics: [
      { id: 'connect', icon: '🔌', label: t('assistant.actions.connection', 'Connection'), query: t('assistant.queries.connectTelematics', 'How do I connect my Geotab or Samsara telematics?') },
      { id: 'data', icon: '📊', label: t('assistant.actions.data', 'Data'), query: t('assistant.queries.telematicsData', 'What data is imported from telematics?') },
      { id: 'groups', icon: '🚛', label: t('assistant.actions.group', 'Group'), query: t('assistant.queries.groupVehicles', 'How do I group my vehicles for analysis?') },
      { id: 'auto-scenarios', icon: '🤖', label: t('assistant.actions.autoScenarios', 'Auto-scenarios'), query: t('assistant.queries.autoGenerateScenarios', 'How do I automatically generate scenarios from my data?') }
    ],
    projects: [
      { id: 'create', icon: '➕', label: t('assistant.actions.create', 'Create'), query: t('assistant.queries.createProject', 'How do I create a new project?') },
      { id: 'configure', icon: '⚙️', label: t('assistant.actions.configure', 'Configure'), query: t('assistant.queries.configureProject', 'How do I configure the analysis duration and discount rate?') },
      { id: 'duplicate', icon: '📋', label: t('assistant.actions.duplicate', 'Duplicate'), query: t('assistant.queries.duplicateProject', 'How do I duplicate an existing project?') },
      { id: 'organize', icon: '🗂️', label: t('assistant.actions.organize', 'Organize'), query: t('assistant.queries.organizeProjects', 'How do I organize my projects effectively?') }
    ],
    suppliers: [
      { id: 'h2-manufacturers', icon: '🚛', label: t('assistant.actions.h2Manufacturers', 'H2 Manufacturers'), query: t('assistant.queries.h2TruckManufacturers', 'What are the hydrogen truck manufacturers in Canada?') },
      { id: 'ev-chargers', icon: '⚡', label: t('assistant.actions.chargers', 'Chargers'), query: t('assistant.queries.chargerSuppliers', 'What charging station suppliers do you recommend?') },
      { id: 'h2-suppliers', icon: '🔋', label: t('assistant.actions.hydrogen', 'Hydrogen'), query: t('assistant.queries.hydrogenSuppliers', 'Who supplies hydrogen?') },
      { id: 'contact', icon: '📞', label: t('assistant.actions.contact', 'Contact'), query: t('assistant.queries.contactSuppliers', 'How can I contact these suppliers?') }
    ],
    home: [
      { id: 'what-is', icon: '❓', label: t('assistant.actions.whatIs', 'What is it?'), query: t('assistant.queries.whatIsH2Fleet', 'What is H2Fleet and how does it work?') },
      { id: 'pricing', icon: '💰', label: t('assistant.actions.pricing', 'Pricing'), query: t('assistant.queries.h2FleetPricing', 'What are the H2Fleet pricing plans?') },
      { id: 'start', icon: '🚀', label: t('assistant.actions.getStarted', 'Get started'), query: t('assistant.queries.getStarted', 'How do I get started with H2Fleet?') }
    ]
  };
  
  // Fallback actions
  return actionsMap[pageType] || [
    { id: 'help-tco', icon: '📊', label: t('assistant.actions.tcoHelp', 'TCO Help'), query: t('assistant.queries.tcoAnalysisHelp', 'Explain how TCO analysis works in H2Fleet') },
    { id: 'first-project', icon: '🚀', label: t('assistant.actions.firstProject', 'First project'), query: t('assistant.queries.guideFirstProject', 'Guide me to create my first TCO project') },
    { id: 'features', icon: '✨', label: t('assistant.actions.features', 'Features'), query: t('assistant.queries.mainFeatures', 'What are the main features of H2Fleet?') }
  ];
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
  const [hasScenarios, setHasScenarios] = useState<boolean | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pageEnteredAt = useRef<number>(Date.now());
  
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const pageType = getPageType(location.pathname);
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

  // Fetch user data to check if they have projects/scenarios
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
        .from('scenarios')
        .select('id, projects!inner(user_id)')
        .eq('projects.user_id', user.id)
        .limit(1)
        .then(({ data }) => {
          setHasScenarios(data && data.length > 0);
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
      has_scenarios: hasScenarios,
    };

    const trigger = evaluateProactiveTriggers(context, shownTriggerIds);
    
    if (trigger) {
      const alreadyShown = messages.some(m => 
        m.role === 'proactive' && m.content === trigger.message
      );
      
      if (!alreadyShown) {
        const proactiveMessage: Message = {
          id: `proactive-${trigger.id}-${Date.now()}`,
          role: 'proactive',
          content: trigger.message,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, proactiveMessage]);
        setShownTriggerIds(prev => new Set([...prev, trigger.id]));
      }
    }
  }, [isOpen, location.pathname, user?.id, hasProjects, hasScenarios, timeOnPage, shownTriggerIds, messages, pageType]);

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
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          message: userMessage.content,
          history,
          context: {
            current_url: location.pathname,
            page_type: pageType,
            user_id: user?.id,
            timestamp: new Date().toISOString(),
            time_on_page: timeOnPage,
            has_projects: hasProjects,
            has_scenarios: hasScenarios,
          },
        }),
      });

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
