import React, { createContext, useContext, useMemo, useState } from 'react';

const UserProfileContext = createContext(null);

const defaultProfile = {
  name: 'Bá Nhân',
  email: 'nguyenbanhan017@gmail.com',
  phone: '0388065549',
  address: 'Hà Nội',
};

export const UserProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(defaultProfile);
  const [avatarUri, setAvatarUri] = useState(null);

  const value = useMemo(
    () => ({
      profile,
      avatarUri,
      updateProfile: (nextProfile) => setProfile(nextProfile),
      updateAvatar: (nextAvatarUri) => setAvatarUri(nextAvatarUri),
    }),
    [profile, avatarUri]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
};
