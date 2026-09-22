import { View, Svg, Path, Rect, Text as SvgText, G, Line, Defs, LinearGradient, Stop } from '@react-pdf/renderer';
import { pdfColors } from '../styles/pdfStyles';

interface AreaChartData {
  year: number;
  value: number;
  [key: string]: number;
}

interface PDFAreaChartProps {
  data: AreaChartData[];
  width?: number;
  height?: number;
  dataKey?: string;
  color?: string;
  showGrid?: boolean;
  showDots?: boolean;
  formatValue?: (value: number) => string;
  yAxisLabel?: string;
  breakEvenYear?: number;
}

export const PDFAreaChart = ({
  data,
  width = 280,
  height = 120,
  dataKey = 'value',
  color = pdfColors.primary,
  showGrid = true,
  showDots = true,
  formatValue = (v) => `$${(v / 1000000).toFixed(1)}M`,
  yAxisLabel,
  breakEvenYear,
}: PDFAreaChartProps) => {
  if (!data || data.length === 0) return null;
  
  const padding = { top: 15, right: 20, bottom: 25, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const values = data.map(d => d[dataKey] as number);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  
  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  
  // Create path for line
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[dataKey] as number)}`)
    .join(' ');
  
  // Create path for area (closed shape)
  const areaPath = [
    ...data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[dataKey] as number)}`),
    `L ${getX(data.length - 1)} ${getY(0)}`,
    `L ${getX(0)} ${getY(0)}`,
    'Z'
  ].join(' ');
  
  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = minValue + (valueRange * i) / 4;
    return { value, y: getY(value) };
  });
  
  // Zero line position
  const zeroY = getY(0);
  
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>
        
        {/* Grid lines */}
        {showGrid && yTicks.map((tick, i) => (
          <Line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={pdfColors.border}
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
        ))}
        
        {/* Zero line (stronger) */}
        {minValue < 0 && maxValue > 0 && (
          <Line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke={pdfColors.textMuted}
            strokeWidth={1}
          />
        )}
        
        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGradient)" />
        
        {/* Line */}
        <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
        
        {/* Data points */}
        {showDots && data.map((d, i) => (
          <G key={i}>
            <Rect
              x={getX(i) - 3}
              y={getY(d[dataKey] as number) - 3}
              width={6}
              height={6}
              rx={3}
              fill={color}
            />
          </G>
        ))}
        
        {/* Break-even marker */}
        {breakEvenYear && (
          <G>
            <Line
              x1={getX(breakEvenYear - data[0].year)}
              y1={padding.top}
              x2={getX(breakEvenYear - data[0].year)}
              y2={padding.top + chartHeight}
              stroke={pdfColors.success}
              strokeWidth={2}
              strokeDasharray="4,2"
            />
            <Rect
              x={getX(breakEvenYear - data[0].year) - 25}
              y={padding.top}
              width={50}
              height={14}
              rx={2}
              fill={pdfColors.success}
            />
            <SvgText
              x={getX(breakEvenYear - data[0].year)}
              y={padding.top + 10}
              style={{ fontSize: 7, fill: 'white', textAnchor: 'middle' }}
            >
              Break-even
            </SvgText>
          </G>
        )}
        
        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={i}
            x={padding.left - 5}
            y={tick.y + 3}
            style={{ fontSize: 7, fill: pdfColors.textMuted, textAnchor: 'end' }}
          >
            {formatValue(tick.value)}
          </SvgText>
        ))}
        
        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every other label if too many
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <SvgText
              key={i}
              x={getX(i)}
              y={height - 5}
              style={{ fontSize: 7, fill: pdfColors.textMuted, textAnchor: 'middle' }}
            >
              {d.year}
            </SvgText>
          );
        })}
        
        {/* Y-axis label */}
        {yAxisLabel && (
          <SvgText
            x={10}
            y={height / 2}
            style={{ fontSize: 7, fill: pdfColors.textMuted }}
            transform={`rotate(-90, 10, ${height / 2})`}
          >
            {yAxisLabel}
          </SvgText>
        )}
      </Svg>
    </View>
  );
};

export default PDFAreaChart;
