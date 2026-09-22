import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Zap, Database } from "lucide-react";

interface ScopesSelectorProps {
  selectedScopes: string[];
  onScopesChange: (scopes: string[]) => void;
}

const AVAILABLE_SCOPES = [
  { 
    id: "read:projects", 
    label: "Read Projects", 
    description: "List and view your projects",
    icon: Eye,
    category: "read"
  },
  { 
    id: "read:scenarios", 
    label: "Read Scenarios", 
    description: "List and view your scenarios",
    icon: Eye,
    category: "read"
  },
  { 
    id: "read:results", 
    label: "Read Results", 
    description: "Access TCO calculation results",
    icon: Eye,
    category: "read"
  },
  { 
    id: "read:reference", 
    label: "Read Reference Data", 
    description: "Access regional pricing and reference data",
    icon: Database,
    category: "read"
  },
  { 
    id: "write:scenarios", 
    label: "Write Scenarios", 
    description: "Create and modify scenarios",
    icon: Edit,
    category: "write"
  },
  { 
    id: "trigger:calculate", 
    label: "Trigger Calculations", 
    description: "Run TCO calculations on scenarios",
    icon: Zap,
    category: "action"
  },
];

const ScopesSelector = ({ selectedScopes, onScopesChange }: ScopesSelectorProps) => {
  const toggleScope = (scopeId: string) => {
    onScopesChange(
      selectedScopes.includes(scopeId)
        ? selectedScopes.filter(s => s !== scopeId)
        : [...selectedScopes, scopeId]
    );
  };

  const selectAll = () => {
    onScopesChange(AVAILABLE_SCOPES.map(s => s.id));
  };

  const selectNone = () => {
    onScopesChange([]);
  };

  const selectReadOnly = () => {
    onScopesChange(AVAILABLE_SCOPES.filter(s => s.category === "read").map(s => s.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">API Scopes</Label>
        <div className="flex gap-2">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-muted"
            onClick={selectReadOnly}
          >
            Read Only
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-muted"
            onClick={selectAll}
          >
            All
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-muted"
            onClick={selectNone}
          >
            None
          </Badge>
        </div>
      </div>
      
      <div className="grid gap-3">
        {AVAILABLE_SCOPES.map(scope => {
          const Icon = scope.icon;
          return (
            <div 
              key={scope.id} 
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                selectedScopes.includes(scope.id) 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border hover:border-muted-foreground/25'
              }`}
            >
              <Checkbox
                id={scope.id}
                checked={selectedScopes.includes(scope.id)}
                onCheckedChange={() => toggleScope(scope.id)}
              />
              <div className="flex-1 grid gap-1 leading-none">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <label htmlFor={scope.id} className="text-sm font-medium cursor-pointer">
                    {scope.label}
                  </label>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {scope.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{scope.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedScopes.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            {selectedScopes.length} scope{selectedScopes.length > 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
};

export default ScopesSelector;
export { AVAILABLE_SCOPES };
