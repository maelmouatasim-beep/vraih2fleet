import { View, Svg, Rect, Text as SvgText, G } from '@react-pdf/renderer';
import { pdfColors } from '../styles/pdfStyles';

interface BarChartData {
  label: string;
  value: number;
  color: string;
}

interface PDFBarChartProps {
  data: BarChartData[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
}

export const PDFBarChart = ({
  data,
  width = 200,
  height = 100,
  showLabels = true,
  showValues = true,
  horizontal = false,
  formatValue = (v) => v.toLocaleString(),
}: PDFBarChartProps) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const padding = { top: 10, right: 10, bottom: showLabels ? 25 : 10, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  if (horizontal) {
    // Horizontal bar chart
    const barHeight = Math.min(25, (chartHeight - (data.length - 1) * 5) / data.length);
    const totalBarsHeight = data.length * barHeight + (data.length - 1) * 5;
    const startY = padding.top + (chartHeight - totalBarsHeight) / 2;
    
    return (
      <View style={{ alignItems: 'center' }}>
        <Svg width={width} height={height}>
          {data.map((item, index) => {
            const barWidth = maxValue > 0 ? (item.value / maxValue) * chartWidth : 0;
            const y = startY + index * (barHeight + 5);
            
            return (
              <G key={index}>
                {/* Background bar */}
                <Rect
                  x={padding.left}
                  y={y}
                  width={chartWidth}
                  height={barHeight}
                  fill={pdfColors.backgroundAlt}
                  rx={4}
                />
                {/* Value bar */}
                <Rect
                  x={padding.left}
                  y={y}
                  width={Math.max(barWidth, 4)}
                  height={barHeight}
                  fill={item.color}
                  rx={4}
                />
                {/* Label */}
                {showLabels && (
                  <SvgText
                    x={padding.left + chartWidth + 5}
                    y={y + barHeight / 2 + 3}
                    style={{ fontSize: 7, fill: pdfColors.textSecondary }}
                  >
                    {item.label}
                  </SvgText>
                )}
                {/* Value */}
                {showValues && barWidth > 40 && (
                  <SvgText
                    x={padding.left + barWidth - 5}
                    y={y + barHeight / 2 + 3}
                    style={{ fontSize: 7, fill: 'white', textAnchor: 'end' }}
                  >
                    {formatValue(item.value)}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>
    );
  }
  
  // Vertical bar chart
  const barWidth = Math.min(40, (chartWidth - (data.length - 1) * 8) / data.length);
  const totalBarsWidth = data.length * barWidth + (data.length - 1) * 8;
  const startX = padding.left + (chartWidth - totalBarsWidth) / 2;
  
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={width} height={height}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
          const x = startX + index * (barWidth + 8);
          const y = padding.top + chartHeight - barHeight;
          
          return (
            <G key={index}>
              {/* Bar with rounded top */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color}
                rx={4}
              />
              {/* Value on top */}
              {showValues && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 4}
                  style={{ fontSize: 7, fill: pdfColors.text, textAnchor: 'middle' }}
                >
                  {formatValue(item.value)}
                </SvgText>
              )}
              {/* Label below */}
              {showLabels && (
                <SvgText
                  x={x + barWidth / 2}
                  y={height - 5}
                  style={{ fontSize: 7, fill: pdfColors.textSecondary, textAnchor: 'middle' }}
                >
                  {item.label}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
};

export default PDFBarChart;
