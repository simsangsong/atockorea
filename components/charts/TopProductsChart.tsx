'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TopProductData {
  name: string;
  orders: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProductData[];
}

export default function TopProductsChart({ data }: TopProductsChartProps) {
  // Format data for chart (limit to top 10)
  const chartData = data.slice(0, 10).map((item) => ({
    name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
    orders: item.orders,
    revenue: Math.round(item.revenue),
  }));

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return `₩${value.toLocaleString()}`;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="name" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          yAxisId="left"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          yAxisId="right"
          orientation="right"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px'
          }}
          formatter={(value: number, name: string) => {
            if (name === 'revenue') {
              return [formatCurrency(value), '收入'];
            }
            return [value, name === 'orders' ? '订单数' : name];
          }}
          labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
        />
        <Legend 
          formatter={(value) => {
            if (value === 'orders') return '订单数';
            if (value === 'revenue') return '收入';
            return value;
          }}
        />
        <Line 
          yAxisId="left"
          type="monotone" 
          dataKey="orders" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="orders"
        />
        <Line 
          yAxisId="right"
          type="monotone" 
          dataKey="revenue" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="revenue"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

