import React, {useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '../context/Store';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean; // true = requires authentication, false = requires no authentication
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = false,
}) => {
  const {accessToken} = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (requireAuth && !accessToken) {
      // User needs to be authenticated but isn't - redirect to login
      navigation.reset({
        index: 0,
        routes: [{name: 'SignIn'}],
      });
    } else if (!requireAuth && accessToken) {
      // Branch picker is a global modal overlay (web parity), not a guest-stack route.
      navigation.reset({
        index: 0,
        routes: [{name: 'Home'}],
      });
    }
  }, [accessToken, requireAuth, navigation]);

  // Don't render children if redirecting
  if (requireAuth && !accessToken) {
    return null;
  }

  if (!requireAuth && accessToken) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;

