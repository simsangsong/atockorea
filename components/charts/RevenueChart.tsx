'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RevenueData {
  date: string;
  amount: number;
  platformFee: number;
  merchantPayout: number;
}

interface RevenueChartProps {
  data: RevenueData[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    amount: Math.round(item.amount),
    platformFee: Math.round(item.platformFee),
    merchantPayout: Math.round(item.merchantPayout),
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
              name === 'amount' ? '总支付金额' :
              name === 'platformFee' ? '平台手续费' :
              name === 'merchantPayout' ? '商家应收金额' : name
            ];
          }}
          labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
        />
        <Legend 
          formatter={(value) => {
            if (value === 'amount') return '总支付金额';
            if (value === 'platformFee') return '平台手续费 (10%)';
            if (value === 'merchantPayout') return '商家应收金额';
            return value;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="amount" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="amount"
        />
        <Line 
          type="monotone" 
          dataKey="platformFee" 
          stroke="#ef4444" 
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 4 }}
          activeDot={{ r: 6 }}
          name="platformFee"
        />
        <Line 
          type="monotone" 
          dataKey="merchantPayout" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="merchantPayout"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

