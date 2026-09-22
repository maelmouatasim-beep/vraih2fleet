import { View, Svg, Rect, Text as SvgText, G, Line } from '@react-pdf/renderer';
import { pdfColors, professionalStyles as styles } from '../styles/pdfStyles';

interface StackedBarData {
  label: string;
  values: { key: string; value: number; color: string }[];
}

interface PDFStackedBarChartProps {
  data: StackedBarData[];
  width?: number;
  height?: number;
  horizontal?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

export const PDFStackedBarChart = ({
  data,
  width = 280,
  height = 150,
  horizontal = true,
  showValues = true,
  showLegend = true,
  formatValue = (v) => `$${(v / 1000000).toFixed(1)}M`,
}: PDFStackedBarChartProps) => {
  if (!data || data.length === 0) return null;
  
  const padding = { top: 15, right: 15, bottom: showLegend ? 40 : 15, left: horizontal ? 80 : 15 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Calculate totals and max
  const dataWithTotals = data.map(d => ({
    ...d,
    total: d.values.reduce((sum, v) => sum + v.value, 0)
  }));
  const maxTotal = Math.max(...dataWithTotals.map(d => d.total));
  
  // Get unique keys for legend
  const legendItems = data[0]?.values.map(v => ({ key: v.key, color: v.color })) || [];
  
  if (horizontal) {
    // Horizontal stacked bars
    const barHeight = Math.min(30, (chartHeight - (data.length - 1) * 10) / data.length);
    const totalBarsHeight = data.length * barHeight + (data.length - 1) * 10;
    const startY = padding.top + (chartHeight - totalBarsHeight) / 2;
    
    return (
      <View style={{ alignItems: 'center' }}>
        <Svg width={width} height={height}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
            <G key={i}>
              <Line
                x1={padding.left + chartWidth * pct}
                y1={padding.top}
                x2={padding.left + chartWidth * pct}
                y2={padding.top + chartHeight}
                stroke={pdfColors.border}
                strokeWidth={0.5}
                strokeDasharray={i === 0 ? '' : '2,2'}
              />
              <SvgText
                x={padding.left + chartWidth * pct}
                y={padding.top + chartHeight + 12}
                style={{ fontSize: 7, fill: pdfColors.textMuted, textAnchor: 'middle' }}
              >
                {formatValue(maxTotal * pct)}
              </SvgText>
            </G>
          ))}
          
          {dataWithTotals.map((item, rowIndex) => {
            const y = startY + rowIndex * (barHeight + 10);
            let currentX = padding.left;
            
            return (
              <G key={rowIndex}>
                {/* Row label */}
                <SvgText
                  x={padding.left - 5}
                  y={y + barHeight / 2 + 3}
                  style={{ fontSize: 8, fill: pdfColors.text, textAnchor: 'end' }}
                >
                  {item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label}
                </SvgText>
                
                {/* Stacked segments */}
                {item.values.map((segment, segIndex) => {
                  const segmentWidth = maxTotal > 0 ? (segment.value / maxTotal) * chartWidth : 0;
                  const x = currentX;
                  currentX += segmentWidth;
                  
                  if (segmentWidth < 1) return null;
                  
                  return (
                    <Rect
                      key={segIndex}
                      x={x}
                      y={y}
                      width={segmentWidth}
                      height={barHeight}
                      fill={segment.color}
                      rx={segIndex === 0 ? 4 : 0}
                      ry={segIndex === 0 ? 4 : 0}
                    />
                  );
                })}
                
                {/* Total value */}
                {showValues && (
                  <SvgText
                    x={padding.left + (item.total / maxTotal) * chartWidth + 5}
                    y={y + barHeight / 2 + 3}
                    style={{ fontSize: 8, fill: pdfColors.text, fontWeight: 'bold' }}
                  >
                    {formatValue(item.total)}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
        
        {/* Legend */}
        {showLegend && (
          <View style={[styles.legendContainer, { marginTop: 5 }]}>
            {legendItems.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <SvgText style={styles.legendText}>{item.key}</SvgText>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  
  // Vertical stacked bars (if needed)
  const barWidth = Math.min(50, (chartWidth - (data.length - 1) * 15) / data.length);
  const totalBarsWidth = data.length * barWidth + (data.length - 1) * 15;
  const startX = padding.left + (chartWidth - totalBarsWidth) / 2;
  
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={width} height={height}>
        {dataWithTotals.map((item, colIndex) => {
          const x = startX + colIndex * (barWidth + 15);
          let currentY = padding.top + chartHeight;
          
          return (
            <G key={colIndex}>
              {/* Stacked segments */}
              {item.values.map((segment, segIndex) => {
                const segmentHeight = maxTotal > 0 ? (segment.value / maxTotal) * chartHeight : 0;
                currentY -= segmentHeight;
                
                if (segmentHeight < 1) return null;
                
                return (
                  <Rect
                    key={segIndex}
                    x={x}
                    y={currentY}
                    width={barWidth}
                    height={segmentHeight}
                    fill={segment.color}
                    rx={segIndex === item.values.length - 1 ? 4 : 0}
                    ry={segIndex === item.values.length - 1 ? 4 : 0}
                  />
                );
              })}
              
              {/* Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 5}
                style={{ fontSize: 7, fill: pdfColors.textSecondary, textAnchor: 'middle' }}
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      
      {showLegend && (
        <View style={styles.legendContainer}>
          {legendItems.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <SvgText style={styles.legendText}>{item.key}</SvgText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default PDFStackedBarChart;
