'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OrdersData {
  date: string;
  orders: number;
  pending: number;
  confirmed: number;
  completed: number;
}

interface OrdersChartProps {
  data: OrdersData[];
}

export default function OrdersChart({ data }: OrdersChartProps) {
  // Format data for chart
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    orders: item.orders,
    pending: item.pending,
    confirmed: item.confirmed,
    completed: item.completed,
  }));

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
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px'
          }}
          labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
        />
        <Legend 
          formatter={(value) => {
            if (value === 'orders') return '总订单数';
            if (value === 'pending') return '待处理';
            if (value === 'confirmed') return '已确认';
            if (value === 'completed') return '已完成';
            return value;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="orders" 
          stroke="#3b82f6" 
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="orders"
        />
        <Line 
          type="monotone" 
          dataKey="pending" 
          stroke="#f59e0b" 
          strokeWidth={2}
          dot={{ fill: '#f59e0b', r: 4 }}
          activeDot={{ r: 6 }}
          name="pending"
        />
        <Line 
          type="monotone" 
          dataKey="confirmed" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="confirmed"
        />
        <Line 
          type="monotone" 
          dataKey="completed" 
          stroke="#6366f1" 
          strokeWidth={2}
          dot={{ fill: '#6366f1', r: 4 }}
          activeDot={{ r: 6 }}
          name="completed"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

