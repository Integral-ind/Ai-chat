
import React, { useState, useEffect, useContext } from 'react';
import { Card, Button, ToggleSwitch } from '../components';
import { PushNotificationSettings } from '../components/PushNotificationSettings';
import { User as FrontendUser, DarkModeContextType } from '../types';
import { 
    IdentificationIcon, EyeIcon, SettingsBellIcon, UserCircleIcon, ShieldCheckIcon, CreditCardIcon, LinkIcon, LifeBuoyIcon
} from '../constants';
import { DarkModeContext } from '../App'; 
import { supabase } from '../supabaseClient'; 

interface SettingsPageProps {
  currentUser: FrontendUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<FrontendUser | null>>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, setCurrentUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const darkModeContext = useContext(DarkModeContext);

  const [profileForm, setProfileForm] = useState({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      avatar_url: currentUser?.avatar_url || ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
        setProfileForm({
            name: currentUser.name,
            email: currentUser.email,
            avatar_url: currentUser.avatar_url || ''
        });
    }
  }, [currentUser]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found for update.");

        // First, update the public user_profiles table.
        const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ full_name: profileForm.name, avatar_url: profileForm.avatar_url })
            .eq('id', currentUser.id);
        
        if (profileError) throw profileError;

        // Then, update the auth user's metadata.
        const { data: updatedUserData, error: authUserError } = await supabase.auth.updateUser({
            data: { 
                full_name: profileForm.name, 
                avatar_url: profileForm.avatar_url 
            }
        });
        
        if (authUserError) throw authUserError;

        if (updatedUserData.user) {
            // Update the local state to reflect the changes immediately in the UI.
            setCurrentUser(prev => prev ? ({ 
                ...prev, 
                name: updatedUserData.user!.user_metadata.full_name, 
                full_name: updatedUserData.user!.user_metadata.full_name,
                avatar_url: updatedUserData.user!.user_metadata.avatar_url 
            }) : null);
        }
        
        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        alert(`Error: ${(error as Error).message}`);
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action is irreversible and will delete all your data.")) {
        alert("Account deletion initiated (mocked). In a real app, this would require backend handling.");
        // Placeholder: In a real app, call a Supabase function to delete user data then supabase.auth.signOut()
        // For example: await supabase.rpc('delete_user_account');
        // supabase.auth.signOut(); // Then redirect via onAuthStateChange in App.tsx
    }
  };

  const settingsSections = [
    { id: 'profile', label: 'Profile', icon: IdentificationIcon },
    { id: 'appearance', label: 'Appearance', icon: EyeIcon },
    { id: 'notifications', label: 'Notifications', icon: SettingsBellIcon },
    { id: 'account', label: 'Account', icon: UserCircleIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
    { id: 'billing', label: 'Billing', icon: CreditCardIcon },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon },
    { id: 'help', label: 'Help & Support', icon: LifeBuoyIcon },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <p className="text-sm text-muted dark:text-muted-dark mb-6">Update your personal details here.</p>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text dark:text-text-dark">Full Name</label>
                <input type="text" name="name" id="name" value={profileForm.name} onChange={handleProfileChange} className="input-style mt-1" required />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text dark:text-text-dark">Email Address</label>
                <input type="email" name="email" id="email" value={profileForm.email} className="input-style mt-1 bg-gray-100 dark:bg-gray-800" disabled readOnly />
              </div>
              <div>
                <label htmlFor="avatar_url" className="block text-sm font-medium text-text dark:text-text-dark">Avatar URL</label>
                <input type="text" name="avatar_url" id="avatar_url" value={profileForm.avatar_url || ''} onChange={handleProfileChange} className="input-style mt-1" placeholder="https://example.com/avatar.png" />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={isSavingProfile}>Save Changes</Button>
              </div>
            </form>
          </Card>
        );
      case 'appearance':
        return (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Appearance</h2>
            <p className="text-sm text-muted dark:text-muted-dark mb-6">Customize the look and feel of the application.</p>
            <div className="flex items-center justify-between p-4 border rounded-lg dark:border-border-dark">
              <div>
                <h3 className="font-medium text-text dark:text-text-dark">Dark Mode</h3>
                <p className="text-xs text-muted dark:text-muted-dark">Toggle between light and dark themes.</p>
              </div>
              <ToggleSwitch checked={darkModeContext?.isDarkMode || false} onChange={darkModeContext?.toggleDarkMode || (() => {})} />
            </div>
          </Card>
        );
      case 'account':
        return (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Account</h2>
            <p className="text-sm text-muted dark:text-muted-dark mb-6">Manage your account settings and plan.</p>
             <div className="space-y-4">
                <div className="p-4 border rounded-lg dark:border-border-dark">
                    <p className="font-medium text-text dark:text-text-dark">Current Plan</p>
                    <p className="text-2xl font-bold text-primary dark:text-primary-light">{currentUser?.plan || "Free Plan"}</p>
                    <Button variant="outline" size="sm" className="mt-2">Upgrade Plan</Button>
                </div>
                <div className="p-4 border border-red-200 dark:border-red-700/60 rounded-lg">
                    <h3 className="font-medium text-red-600 dark:text-red-400">Delete Account</h3>
                    <p className="text-xs text-muted dark:text-muted-dark mt-1 mb-3">This action is irreversible and will permanently delete all your data.</p>
                    <Button variant="danger" onClick={handleDeleteAccount}>Delete My Account</Button>
                </div>
            </div>
          </Card>
        );
      case 'notifications':
        return (
          <Card className="p-6">
            <PushNotificationSettings currentUser={currentUser} />
          </Card>
        );
      default:
        return (
            <Card className="p-6 text-center">
                <h2 className="text-xl font-semibold mb-4">{settingsSections.find(s => s.id === activeTab)?.label}</h2>
                <p className="text-muted dark:text-muted-dark">This section is under construction. Check back soon!</p>
            </Card>
        );
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-background dark:bg-background-dark">
      {/* Sidebar Navigation for md and up */}
      <aside className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-border dark:border-border-dark p-4">
        <h1 className="text-lg font-semibold mb-4 px-2 text-text dark:text-text-dark">Settings</h1>
        <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible scrollbar-hide space-x-2 md:space-x-0 md:space-y-1">
          {settingsSections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left whitespace-nowrap
                ${activeTab === section.id
                  ? 'bg-primary/10 dark:bg-primary-dark/20 text-primary dark:text-primary-light'
                  : 'text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-surface-dark hover:text-text dark:hover:text-text-dark'
                }`}
            >
              <section.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === section.id ? 'text-primary dark:text-primary-light' : ''}`} />
              <span className="flex-grow">{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
};
