'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  title: string;
  city: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch products from API (only merchant's own products)
    // For now, use placeholder data
    setProducts([
      {
        id: '1',
        title: 'Jeju UNESCO Original Day Tour',
        city: 'Jeju',
        price: 80000,
        is_active: true,
        created_at: '2024-01-10',
      },
      {
        id: '2',
        title: 'Seoul Palace & Market Tour',
        city: 'Seoul',
        price: 69000,
        is_active: true,
        created_at: '2024-01-12',
      },
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">产品管理</h1>
          <p className="text-gray-600 mt-2">管理您的旅游产品</p>
        </div>
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          ➕ 添加新产品
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-500">加载中...</div>
        ) : products.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-500">
            <p className="mb-4">还没有产品</p>
            <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              添加第一个产品
            </button>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {product.title}
                    </h3>
                    <p className="text-sm text-gray-500">{product.city}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      product.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {product.is_active ? '在售' : '下架'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      ₩{product.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">创建于 {product.created_at}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/merchant/products/${product.id}`}
                      className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      编辑
                    </Link>
                    <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                      {product.is_active ? '下架' : '上架'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

