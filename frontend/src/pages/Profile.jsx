import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { User, Camera, Lock, Save, X } from 'lucide-react';
import { getMyProfileDetails, updateProfile, changePassword, fileUpload } from '../api/authService';

// Validation schemas
const profileSchema = yup.object().shape({
  first_name: yup.string().required('First name is required'),
  last_name: yup.string().required('Last name is required'),
  phone_number: yup.string().nullable(),
  department: yup.string().nullable(),
});

const passwordSchema = yup.object().shape({
  current_password: yup.string().required('Current password is required'),
  new_password: yup.string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters'),
  confirm_password: yup.string()
    .required('Please confirm your password')
    .oneOf([yup.ref('new_password')], 'Passwords must match'),
});

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm({
    resolver: yupResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: yupResolver(passwordSchema),
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await getMyProfileDetails();
      if (response.success) {
        setProfile(response.body);
        resetProfile({
          first_name: response.body.first_name || '',
          last_name: response.body.last_name || '',
          phone_number: response.body.phone_number || '',
          department: response.body.department || '',
        });
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const onProfileSubmit = async (data) => {
    try {
      setSaving(true);
      const response = await updateProfile(data);
      if (response.success) {
        toast.success('Profile updated successfully');
        setProfile({ ...profile, ...response.body });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      setChangingPassword(true);
      const response = await changePassword(data.current_password, data.new_password);
      if (response.success) {
        toast.success('Password changed successfully');
        resetPassword();
        setShowPasswordForm(false);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      const response = await fileUpload(file);
      if (response.success && response.body?.[0]) {
        const profileUrl = response.body[0];
        await updateProfile({ profile_url: profileUrl });
        setProfile({ ...profile, profile_url: profileUrl });
        toast.success('Profile photo updated');
      }
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getInitials = () => {
    if (!profile) return '?';
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Profile Header Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-6">
          {/* Profile Photo */}
          <div className="relative">
            {profile?.profile_url ? (
              <img
                src={profile.profile_url}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                {getInitials()}
              </div>
            )}
            <label
              htmlFor="photo-upload"
              className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50 border border-gray-200"
            >
              {uploadingPhoto ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              ) : (
                <Camera size={16} className="text-gray-600" />
              )}
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={uploadingPhoto}
            />
          </div>

          {/* User Info */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p className="text-gray-500">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                {profile?.role?.replace('_', ' ')}
              </span>
              {profile?.department && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {profile.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={20} />
          Profile Information
        </h3>
        <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                {...registerProfile('first_name')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  profileErrors.first_name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {profileErrors.first_name && (
                <p className="mt-1 text-sm text-red-500">{profileErrors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                {...registerProfile('last_name')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  profileErrors.last_name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {profileErrors.last_name && (
                <p className="mt-1 text-sm text-red-500">{profileErrors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                {...registerProfile('phone_number')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                {...registerProfile('department')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Department</option>
                <option value="General">General</option>
                <option value="Acquisitions">Acquisitions</option>
                <option value="Asset Management">Asset Management</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock size={20} />
            Security
          </h3>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  {...registerPassword('current_password')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    passwordErrors.current_password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordErrors.current_password && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.current_password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  {...registerPassword('new_password')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    passwordErrors.new_password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordErrors.new_password && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.new_password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  {...registerPassword('confirm_password')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    passwordErrors.confirm_password ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordErrors.confirm_password && (
                  <p className="mt-1 text-sm text-red-500">{passwordErrors.confirm_password.message}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  resetPassword();
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={changingPassword}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">
            Keep your account secure by using a strong password that you don't use elsewhere.
          </p>
        )}
      </div>
    </div>
  );
};

export default Profile;
