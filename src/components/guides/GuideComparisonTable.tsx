import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, Minus } from "lucide-react";

interface ComparisonRow {
  labelKey: string;
  bev?: string | boolean;
  fcev?: string | boolean;
  biomethane?: string | boolean;
  diesel?: string | boolean;
}

interface GuideComparisonTableProps {
  rows: ComparisonRow[];
  showDiesel?: boolean;
}

const renderValue = (value: string | boolean | undefined) => {
  if (value === undefined) return <Minus className="w-4 h-4 text-muted-foreground" />;
  if (value === true) return <Check className="w-4 h-4 text-green-600" />;
  if (value === false) return <X className="w-4 h-4 text-red-600" />;
  return <span className="text-sm">{value}</span>;
};

const GuideComparisonTable = ({ rows, showDiesel = true }: GuideComparisonTableProps) => {
  const { t } = useTranslation();

  return (
    <div className="my-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">{t("guides.comparison.criteria", "Criteria")}</TableHead>
            <TableHead className="text-center">{t("guides.comparison.bev", "BEV")}</TableHead>
            <TableHead className="text-center">{t("guides.comparison.fcev", "H₂ (FCEV)")}</TableHead>
            <TableHead className="text-center">{t("guides.comparison.biomethane", "Biomethane")}</TableHead>
            {showDiesel && (
              <TableHead className="text-center">{t("guides.comparison.diesel", "Diesel")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{t(row.labelKey)}</TableCell>
              <TableCell className="text-center">{renderValue(row.bev)}</TableCell>
              <TableCell className="text-center">{renderValue(row.fcev)}</TableCell>
              <TableCell className="text-center">{renderValue(row.biomethane)}</TableCell>
              {showDiesel && (
                <TableCell className="text-center">{renderValue(row.diesel)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default GuideComparisonTable;
