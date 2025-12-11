'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RevenueTrendData {
  date: string;
  revenue: number;
  pendingSettlement: number;
  settledRevenue: number;
}

interface RevenueTrendChartProps {
  data: RevenueTrendData[];
}

export default function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    revenue: Math.round(item.revenue),
    pendingSettlement: Math.round(item.pendingSettlement),
    settledRevenue: Math.round(item.settledRevenue),
  }));

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return `₩${value.toLocaleString()}`;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
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
            return [formatCurrency(value), 
              name === 'revenue' ? '总收入' :
              name === 'pendingSettlement' ? '待结算' :
              name === 'settledRevenue' ? '已结算' : name
            ];
          }}
          labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
        />
        <Legend 
          formatter={(value) => {
            if (value === 'revenue') return '总收入';
            if (value === 'pendingSettlement') return '待结算';
            if (value === 'settledRevenue') return '已结算';
            return value;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="revenue" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="revenue"
        />
        <Line 
          type="monotone" 
          dataKey="pendingSettlement" 
          stroke="#f59e0b" 
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 4 }}
          activeDot={{ r: 6 }}
          name="pendingSettlement"
        />
        <Line 
          type="monotone" 
          dataKey="settledRevenue" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="settledRevenue"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

