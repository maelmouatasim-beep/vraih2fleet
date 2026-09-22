import { View, Svg, Circle, Path, Text as SvgText, G } from '@react-pdf/renderer';
import { pdfColors, professionalStyles as styles } from '../styles/pdfStyles';

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface PDFDonutChartProps {
  data: DonutChartData[];
  size?: number;
  innerRadius?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

export const PDFDonutChart = ({
  data,
  size = 120,
  innerRadius = 0.55,
  showLegend = true,
  showPercentages = false,
  centerLabel,
  centerValue,
}: PDFDonutChartProps) => {
  if (!data || data.length === 0) return null;
  
  const filteredData = data.filter(d => d.value > 0);
  if (filteredData.length === 0) return null;
  
  const total = filteredData.reduce((sum, d) => sum + d.value, 0);
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size / 2 - 5;
  const inner = outerRadius * innerRadius;
  
  let currentAngle = -90; // Start from top
  
  const paths = filteredData.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Outer arc points
    const x1Outer = centerX + outerRadius * Math.cos(startRad);
    const y1Outer = centerY + outerRadius * Math.sin(startRad);
    const x2Outer = centerX + outerRadius * Math.cos(endRad);
    const y2Outer = centerY + outerRadius * Math.sin(endRad);
    
    // Inner arc points
    const x1Inner = centerX + inner * Math.cos(endRad);
    const y1Inner = centerY + inner * Math.sin(endRad);
    const x2Inner = centerX + inner * Math.cos(startRad);
    const y2Inner = centerY + inner * Math.sin(startRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    // Create donut segment path
    const d = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      'Z'
    ].join(' ');
    
    return <Path key={index} d={d} fill={item.color} />;
  });
  
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {paths}
          {/* Center text */}
          {(centerValue || centerLabel) && (
            <>
              {centerValue && (
                <SvgText
                  x={centerX}
                  y={centerLabel ? centerY - 4 : centerY + 4}
                  style={{ 
                    fontSize: 14, 
                    fill: pdfColors.text, 
                    textAnchor: 'middle',
                    fontWeight: 'bold'
                  }}
                >
                  {centerValue}
                </SvgText>
              )}
              {centerLabel && (
                <SvgText
                  x={centerX}
                  y={centerValue ? centerY + 10 : centerY + 4}
                  style={{ 
                    fontSize: 8, 
                    fill: pdfColors.textMuted, 
                    textAnchor: 'middle'
                  }}
                >
                  {centerLabel}
                </SvgText>
              )}
            </>
          )}
        </G>
      </Svg>
      
      {/* Legend */}
      {showLegend && (
        <View style={styles.legendContainer}>
          {filteredData.map((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(0);
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <SvgText style={styles.legendText}>
                  {item.label}{showPercentages ? ` (${percentage}%)` : ''}
                </SvgText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default PDFDonutChart;
