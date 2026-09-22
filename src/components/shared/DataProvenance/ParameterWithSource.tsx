import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DataBadge, DataSourceType } from "./DataBadge";
import { cn } from "@/lib/utils";
import { Satellite, Edit3, BookOpen } from "lucide-react";

export interface SourceOption {
  type: DataSourceType;
  value: number | string;
  label?: string;
  available: boolean;
  tooltip?: string;
}

interface ParameterWithSourceProps {
  label: string;
  unit?: string;
  availableSources: SourceOption[];
  selectedSource: DataSourceType;
  manualValue?: number | string;
  onChange: (source: DataSourceType, value?: number | string) => void;
  className?: string;
}

const sourceIcons: Record<DataSourceType, React.ReactNode> = {
  real_data: <Satellite className="h-4 w-4" />,
  user_input: <Edit3 className="h-4 w-4" />,
  reference_data: <BookOpen className="h-4 w-4" />,
  calculated: <span className="text-sm">🧮</span>,
};

export function ParameterWithSource({
  label,
  unit,
  availableSources,
  selectedSource,
  manualValue,
  onChange,
  className,
}: ParameterWithSourceProps) {
  const { t } = useTranslation();

  const currentSource = availableSources.find(s => s.type === selectedSource);
  const displayValue = selectedSource === "user_input" ? manualValue : currentSource?.value;

  return (
    <div className={cn("space-y-3 p-4 rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <DataBadge type={selectedSource} size="sm" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-foreground">
          {typeof displayValue === "number" ? displayValue.toLocaleString() : displayValue}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">
          {t("dataProvenance.selectSource")}:
        </p>
        <RadioGroup
          value={selectedSource}
          onValueChange={(value) => onChange(value as DataSourceType)}
          className="space-y-2"
        >
          {availableSources.map((source) => (
            <div
              key={source.type}
              className={cn(
                "flex items-center space-x-3 p-2 rounded-md border transition-colors",
                source.type === selectedSource
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:bg-muted/50",
                !source.available && "opacity-50 cursor-not-allowed"
              )}
            >
              <RadioGroupItem
                value={source.type}
                id={`${label}-${source.type}`}
                disabled={!source.available}
              />
              <Label
                htmlFor={`${label}-${source.type}`}
                className={cn(
                  "flex items-center gap-2 cursor-pointer flex-1",
                  !source.available && "cursor-not-allowed"
                )}
              >
                {sourceIcons[source.type]}
                <span className="flex-1">
                  {source.label || t(`dataProvenance.sources.${source.type}`)}
                </span>
                {source.available && source.type !== "user_input" && (
                  <span className="text-sm text-muted-foreground">
                    {typeof source.value === "number" ? source.value.toLocaleString() : source.value}
                    {unit && ` ${unit}`}
                  </span>
                )}
                {!source.available && (
                  <span className="text-xs text-muted-foreground">
                    {t("dataProvenance.notAvailable")}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {selectedSource === "user_input" && (
          <div className="mt-3">
            <Input
              type="number"
              value={manualValue || ""}
              onChange={(e) => onChange("user_input", parseFloat(e.target.value) || 0)}
              placeholder={t("dataProvenance.enterValue")}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
