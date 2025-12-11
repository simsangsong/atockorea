'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

export default function AccountSettingsPage() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+82 10-1234-5678',
    dateOfBirth: '1990-01-01',
    address: '',
    city: 'Seoul',
    country: 'South Korea',
    language: 'en',
    timezone: 'Asia/Seoul',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false,
    bookingReminders: true,
    promotionalOffers: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
    allowMessages: true,
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Simulate upload (in production, upload to storage service)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // In production, upload to Supabase Storage or similar
      // const { data, error } = await supabase.storage
      //   .from('avatars')
      //   .upload(`${userId}/${file.name}`, file);
      
      const avatarUrl = URL.createObjectURL(file);
      setAvatar(avatarUrl);
      
      // Save to localStorage (in production, save to database)
      localStorage.setItem('userAvatar', avatarUrl);
      
      // Trigger custom event for layout update
      window.dispatchEvent(new CustomEvent('userDataUpdated'));
      
      alert('Avatar updated successfully!');
    } catch (error) {
      alert('Failed to upload avatar. Please try again.');
      console.error('Avatar upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePersonalInfo = async () => {
    try {
      // In production, save to database
      // await supabase.from('user_profiles').update({
      //   full_name: formData.name,
      //   phone: formData.phone,
      //   ...
      // }).eq('id', userId);
      
      // Save to localStorage for immediate update
      localStorage.setItem('userName', formData.name);
      localStorage.setItem('userEmail', formData.email);
      
      // Trigger custom event for layout update
      window.dispatchEvent(new CustomEvent('userDataUpdated'));
      
      alert('Personal information saved successfully!');
    } catch (error) {
      alert('Failed to save information. Please try again.');
      console.error('Save error:', error);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    try {
      // In production, update password via Supabase Auth
      // const { error } = await supabase.auth.updateUser({
      //   password: passwordData.newPassword
      // });
      
      alert('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      alert('Failed to update password. Please try again.');
      console.error('Password update error:', error);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      // In production, save to database
      alert('Notification preferences saved!');
    } catch (error) {
      alert('Failed to save preferences. Please try again.');
      console.error('Save error:', error);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      // In production, save to database
      alert('Privacy settings saved!');
    } catch (error) {
      alert('Failed to save privacy settings. Please try again.');
      console.error('Save error:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">Account Settings</h1>
        <p className="text-[15px] text-gray-600 font-medium">Manage your account information and preferences</p>
      </div>

      {/* Profile Picture */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {avatarPreview || avatar ? (
              <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_8px_20px_rgba(99,102,241,0.3)]">
                <Image
                  src={avatarPreview || avatar || ''}
                  alt="Profile"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold shadow-[0_8px_20px_rgba(99,102,241,0.3)]">
                JD
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-4 font-medium">
              Upload a new profile picture. JPG, PNG or WEBP (max. 5MB)
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Change Picture'}
              </button>
              {avatarPreview && (
                <button
                  onClick={() => {
                    setAvatarPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-base"
                >
                  Cancel
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="+82 10-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Street address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            >
              <option value="South Korea">South Korea</option>
              <option value="United States">United States</option>
              <option value="China">China</option>
              <option value="Japan">Japan</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSavePersonalInfo}
          className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base"
        >
          Save Changes
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Change Password</h2>
        <div className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Enter new password (min. 8 characters)"
            />
            <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Confirm new password"
            />
          </div>
          <button
            onClick={handleUpdatePassword}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base"
          >
            Update Password
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            >
              <option value="Asia/Seoul">Asia/Seoul (KST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSavePersonalInfo}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base"
        >
          Save Preferences
        </button>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Notification Preferences</h2>
        <div className="space-y-4">
          {[
            { key: 'email', label: 'Email Notifications', description: 'Receive notifications via email' },
            { key: 'sms', label: 'SMS Notifications', description: 'Receive notifications via SMS' },
            { key: 'push', label: 'Push Notifications', description: 'Receive push notifications on your device' },
            { key: 'bookingReminders', label: 'Booking Reminders', description: 'Get reminded about upcoming tours' },
            { key: 'marketing', label: 'Marketing Emails', description: 'Receive promotional offers and updates' },
            { key: 'promotionalOffers', label: 'Promotional Offers', description: 'Get notified about special deals' },
          ].map((item) => (
            <div key={item.key} className="flex items-start justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors">
              <div className="flex-1">
                <label className="text-base font-medium text-gray-900 cursor-pointer">{item.label}</label>
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              </div>
              <input
                type="checkbox"
                checked={notifications[item.key as keyof typeof notifications]}
                onChange={(e) =>
                  setNotifications({ ...notifications, [item.key]: e.target.checked })
                }
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-1"
              />
            </div>
          ))}
          <button
            onClick={handleSaveNotifications}
            className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 tracking-tight">Privacy Settings</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Visibility</label>
            <select
              value={privacy.profileVisibility}
              onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            >
              <option value="public">Public - Everyone can see your profile</option>
              <option value="friends">Friends Only - Only your connections can see</option>
              <option value="private">Private - Only you can see</option>
            </select>
          </div>
          <div className="space-y-4">
            {[
              { key: 'showEmail', label: 'Show Email Address', description: 'Display your email on your public profile' },
              { key: 'showPhone', label: 'Show Phone Number', description: 'Display your phone number on your public profile' },
              { key: 'allowMessages', label: 'Allow Messages', description: 'Allow others to send you messages' },
            ].map((item) => (
              <div key={item.key} className="flex items-start justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors">
                <div className="flex-1">
                  <label className="text-base font-medium text-gray-900 cursor-pointer">{item.label}</label>
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!(privacy[item.key as keyof typeof privacy] as boolean)}
                  onChange={(e) =>
                    setPrivacy({ ...privacy, [item.key]: e.target.checked })
                  }
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 mt-1"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSavePrivacy}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-base"
          >
            Save Privacy Settings
          </button>
        </div>
      </div>
    </div>
  );
}

