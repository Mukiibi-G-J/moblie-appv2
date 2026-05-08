import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';
import {loginUser} from '../services/auth.services';
import {jwtDecode} from 'jwt-decode';
import Toast from 'react-native-toast-message';
import {
  AuthState,
  DecodedToken,
  defaultUserJwtPermissions,
} from '../types/auth';
import {AUTH_FORCE_LOGOUT_EVENT} from '../utils/authEvents';
import {
  RESTAURANT_PIN_SETUP_PENDING_KEY,
  RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
  clearRestaurantPinRouteSessionFlags,
  getRestaurantDevicePrefs,
  setRestaurantDevicePrefs,
  getOrCreateRestaurantDeviceId,
} from '../storage/restaurantDeviceStorage';
import {shouldOfferRestaurantPinFromToken} from '../utils/restaurantPinOffer';
import {setVerifiedEmail} from '../utils/tenant';

export interface AppContextType {
  auth: AuthState;
  branchSession: BranchSessionState;
  login: (userCredentials: {
    email: string;
    password: string;
    tenant?: string;
  }) => Promise<any>;
  loginWithTokens: (access: string, refresh?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthState: () => void;
  setActiveBranch: (branch: BranchValue | null) => Promise<void>;
  setBranchSelectionPending: (pending: boolean) => Promise<void>;
  refreshBranchCapabilities: () => Promise<void>;
}
const AppContext = createContext<AppContextType | null>(null);
const SelectedTabContext = createContext<string>('Home');
const SetSelectedTabContext = createContext<(tab: string) => void>(() => {});

export type BranchValue = {id: number; code: string; description: string};

export type BranchSessionState = {
  active_branch_id: number | null;
  active_branch: BranchValue | null;
  branchSelectionPending: boolean;
  enable_multiple_branches: boolean;
  can_switch_branch: boolean;
};

const BRANCH_SESSION_KEYS = {
  activeBranch: 'branch.active_branch',
  activeBranchId: 'branch.active_branch_id',
  selectionPending: 'branch.branchSelectionPending',
  enableMultiple: 'branch.enable_multiple_branches',
  canSwitch: 'branch.can_switch_branch',
} as const;

const getEmptyBranchSession = (): BranchSessionState => ({
  active_branch_id: null,
  active_branch: null,
  branchSelectionPending: false,
  enable_multiple_branches: false,
  // Strict default until JWT hydration marks who may switch (web: old tokens default true).
  can_switch_branch: false,
});

async function autoRegisterRestaurantDeviceIfEligible(
  user: AuthState,
): Promise<void> {
  try {
    if (
      !shouldOfferRestaurantPinFromToken(
        user.role_center_modules,
        user.enabled_modules,
        user.authority,
      )
    ) {
      return;
    }
    const existing = await getRestaurantDevicePrefs();
    if (
      existing?.isRestaurantDevice &&
      existing.deviceId &&
      existing.schemaName
    ) {
      return;
    }
    const tenant = user.schema_name;
    if (!tenant) {
      return;
    }
    const deviceId = await getOrCreateRestaurantDeviceId();
    await setRestaurantDevicePrefs({
      isRestaurantDevice: true,
      deviceId,
      schemaName: tenant.trim().toLowerCase(),
      enrolledStaffName: user.full_name?.trim() || undefined,
    });
  } catch {
    /* non-fatal — PIN screen is a convenience feature */
  }
}

const getEmptyAuthState = (): AuthState => ({
  user_id: '',
  username: '',
  full_name: '',
  email: '',
  phone: undefined,
  verified: undefined,
  is_superuser: false,
  authority: [],
  role_center_modules: [],
  roles: [],
  user_groups: [],
  permission_sets: [],
  page_permissions: {},
  userPermissions: defaultUserJwtPermissions(),
  enabled_modules: ['pos'],
});

export const AppProvider = ({children}: {children: React.ReactNode}) => {
  const [auth, setAuth] = useState<AuthState>(getEmptyAuthState());
  const [branchSession, setBranchSessionState] = useState<BranchSessionState>(
    getEmptyBranchSession(),
  );
  const [cartItems, setCartItems] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Home');

  const clearAuthState = useCallback(() => {
    // Clear auth state without clearing AsyncStorage (for token expiry scenarios)
    setAuth(getEmptyAuthState());

    // Clear cart items from state
    setCartItems([]);

    // Clear branch session in-memory (storage is cleared in logout())
    setBranchSessionState(getEmptyBranchSession());
  }, []);

  const hydrateBranchSession = useCallback(async () => {
    try {
      const [
        rawActiveBranch,
        rawActiveBranchId,
        rawPending,
        rawEnableMultiple,
        rawCanSwitch,
      ] = await Promise.all([
        AsyncStorage.getItem(BRANCH_SESSION_KEYS.activeBranch),
        AsyncStorage.getItem(BRANCH_SESSION_KEYS.activeBranchId),
        AsyncStorage.getItem(BRANCH_SESSION_KEYS.selectionPending),
        AsyncStorage.getItem(BRANCH_SESSION_KEYS.enableMultiple),
        AsyncStorage.getItem(BRANCH_SESSION_KEYS.canSwitch),
      ]);

      const active_branch: BranchValue | null = rawActiveBranch
        ? (JSON.parse(rawActiveBranch) as BranchValue)
        : null;
      const active_branch_id =
        rawActiveBranchId != null ? Number(rawActiveBranchId) : null;
      const branchSelectionPending = rawPending === '1';
      const enable_multiple_branches = rawEnableMultiple === '1';
      const can_switch_branch = rawCanSwitch === '1';

      setBranchSessionState({
        active_branch,
        active_branch_id: Number.isFinite(active_branch_id as any)
          ? active_branch_id
          : active_branch?.id ?? null,
        branchSelectionPending,
        enable_multiple_branches,
        can_switch_branch,
      });
    } catch (e) {
      // Non-fatal: fall back to defaults
      setBranchSessionState(getEmptyBranchSession());
    }
  }, []);

  const setActiveBranch = useCallback(async (branch: BranchValue | null) => {
    const id = branch?.id ?? null;
    await Promise.all([
      AsyncStorage.setItem(
        BRANCH_SESSION_KEYS.activeBranch,
        branch ? JSON.stringify(branch) : '',
      ),
      AsyncStorage.setItem(
        BRANCH_SESSION_KEYS.activeBranchId,
        id != null ? String(id) : '',
      ),
    ]);
    setBranchSessionState((prev) => ({
      ...prev,
      active_branch: branch,
      active_branch_id: id,
    }));
  }, []);

  const setBranchSelectionPending = useCallback(async (pending: boolean) => {
    await AsyncStorage.setItem(BRANCH_SESSION_KEYS.selectionPending, pending ? '1' : '0');
    setBranchSessionState((prev) => ({
      ...prev,
      branchSelectionPending: pending,
    }));
  }, []);

  const refreshBranchCapabilities = useCallback(async () => {
    // Default to JWT flags if present; can be refined by sales setup later.
    const enableMultiple = auth.enable_multiple_branches === true;
    const canSwitch = auth.can_switch_branch !== false;
    await Promise.all([
      AsyncStorage.setItem(BRANCH_SESSION_KEYS.enableMultiple, enableMultiple ? '1' : '0'),
      AsyncStorage.setItem(BRANCH_SESSION_KEYS.canSwitch, canSwitch ? '1' : '0'),
    ]);
    setBranchSessionState((prev) => ({
      ...prev,
      enable_multiple_branches: enableMultiple,
      can_switch_branch: canSwitch,
    }));
  }, [auth.enable_multiple_branches, auth.can_switch_branch]);

  const ensureBranchSelectionGate = useCallback(
    async (args: {
      enableMultiple: boolean;
      canSwitch: boolean;
      /** After login/PIN: force picker only when still no assigned branch in JWT (web sets branch from JWT first). */
      requireSelectionAfterTokenIssue?: boolean;
      jwtHasAssignedBranch?: boolean;
    }) => {
      if (!args.enableMultiple || !args.canSwitch) {
        await AsyncStorage.setItem(BRANCH_SESSION_KEYS.selectionPending, '0');
        setBranchSessionState((prev) => ({...prev, branchSelectionPending: false}));
        return;
      }

      if (args.requireSelectionAfterTokenIssue && args.jwtHasAssignedBranch) {
        await AsyncStorage.setItem(BRANCH_SESSION_KEYS.selectionPending, '0');
        setBranchSessionState((prev) => ({...prev, branchSelectionPending: false}));
        return;
      }

      if (args.requireSelectionAfterTokenIssue) {
        await AsyncStorage.setItem(BRANCH_SESSION_KEYS.selectionPending, '1');
        setBranchSessionState((prev) => ({...prev, branchSelectionPending: true}));
        return;
      }

      const rawId = await AsyncStorage.getItem(BRANCH_SESSION_KEYS.activeBranchId);
      const hasActive = rawId != null && rawId.trim() !== '';
      const pending = !hasActive;
      await AsyncStorage.setItem(BRANCH_SESSION_KEYS.selectionPending, pending ? '1' : '0');
      setBranchSessionState((prev) => ({...prev, branchSelectionPending: pending}));
    },
    [],
  );

  /**
   * Match web `finalizeLoginSession`: apply JWT `global_dimension_1` to the working branch session.
   * Switchers keep a stored choice when present; locked users always follow JWT.
   */
  const applyGlobalDimensionFromJwt = useCallback(
    async (decoded: DecodedToken) => {
      const gd = decoded.global_dimension_1;
      if (!gd || !Number.isFinite(Number(gd.id)) || !String(gd.code ?? '').trim()) {
        return;
      }
      const branch: BranchValue = {
        id: Number(gd.id),
        code: String(gd.code).trim(),
        description: String(gd.description ?? gd.code ?? '').trim() || String(gd.code).trim(),
      };
      const canSwitch = decoded.can_switch_branch !== false;
      if (!canSwitch) {
        await setActiveBranch(branch);
        return;
      }
      const rawId = await AsyncStorage.getItem(BRANCH_SESSION_KEYS.activeBranchId);
      const hasStored = rawId != null && rawId.trim() !== '';
      if (!hasStored) {
        await setActiveBranch(branch);
      }
    },
    [setActiveBranch],
  );

  /**
   * Map decoded JWT token to AuthState
   * Extracts all permission fields from the token
   */
  const mapTokenToAuthState = useCallback((decodedToken: DecodedToken): AuthState => {
    return {
      user_id: decodedToken.user_id?.toString() || '',
      username: decodedToken.username || '',
      full_name: decodedToken.full_name || '',
      email: decodedToken.email || '',
      phone: decodedToken.phone,
      verified: decodedToken.verified,
      is_superuser: decodedToken.is_superuser || false,
      // Legacy authority (backward compatibility)
      authority: decodedToken.authority || [],
      // Layer 1: Role Center (Module Visibility)
      role_center_modules: decodedToken.role_center_modules || [],
      // Layer 2 & 3: Permission Sets & Page Permissions
      roles: decodedToken.roles || [],
      user_groups: decodedToken.user_groups || [],
      permission_sets: decodedToken.permission_sets || [],
      page_permissions: decodedToken.page_permissions || {},
      userPermissions: {
        ...defaultUserJwtPermissions(),
        ...(decodedToken.user_permissions || {}),
      },
      enable_multiple_branches: decodedToken.enable_multiple_branches,
      can_switch_branch: decodedToken.can_switch_branch,
      global_dimension_1: decodedToken.global_dimension_1 ?? null,
      enabled_modules: decodedToken.enabled_modules || ['pos'],
      schema_name: decodedToken.schema_name,
    };
  }, []);

  const hydrateSessionFromTokens = useCallback(
    async (access: string, refresh?: string) => {
      const decodedToken = jwtDecode(access) as DecodedToken;
      const user = mapTokenToAuthState(decodedToken);
      if (user.verified === true) {
        await setVerifiedEmail(true);
      } else if (user.verified === false) {
        await setVerifiedEmail(false);
      }

      const storageItems: [string, string][] = [['accessToken', access]];
      if (refresh) {
        storageItems.push(['refreshToken', refresh]);
        storageItems.push(['userData', JSON.stringify(decodedToken)]);
      }
      await AsyncStorage.multiSet(storageItems);

      setAuth(user);

      await autoRegisterRestaurantDeviceIfEligible(user);

      await Promise.all([
        AsyncStorage.setItem(
          BRANCH_SESSION_KEYS.enableMultiple,
          user.enable_multiple_branches === true ? '1' : '0',
        ),
        AsyncStorage.setItem(
          BRANCH_SESSION_KEYS.canSwitch,
          user.can_switch_branch === false ? '0' : '1',
        ),
      ]);
      setBranchSessionState((prev) => ({
        ...prev,
        enable_multiple_branches: user.enable_multiple_branches === true,
        can_switch_branch: user.can_switch_branch !== false,
      }));
      await applyGlobalDimensionFromJwt(decodedToken);
      const jwtBranch = decodedToken.global_dimension_1;
      const jwtHasAssignedBranch = Boolean(
        jwtBranch &&
          Number.isFinite(Number(jwtBranch.id)) &&
          String(jwtBranch.code ?? '').trim().length > 0,
      );
      await ensureBranchSelectionGate({
        enableMultiple: user.enable_multiple_branches === true,
        canSwitch: user.can_switch_branch !== false,
        requireSelectionAfterTokenIssue: true,
        jwtHasAssignedBranch,
      });

      setTimeout(() => {
        setAuth((prevAuth) => ({...prevAuth, ...user}));
      }, 50);
    },
    [mapTokenToAuthState, ensureBranchSelectionGate, applyGlobalDimensionFromJwt],
  );
  useEffect(() => {
    const checkAccessToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        try {
          const decodedToken = jwtDecode(token) as any;
          console.log('Raw existing token:', decodedToken);

          // Check if token is expired
          const currentTime = Date.now() / 1000;
          if (decodedToken.exp && decodedToken.exp < currentTime) {
            console.log('Token is expired, clearing auth state');
            clearAuthState();
            await AsyncStorage.removeItem('accessToken');
            return;
          }

          // Map the decoded token to our expected structure
          const user = mapTokenToAuthState(decodedToken as DecodedToken);

          if (user.verified === false) {
            await setVerifiedEmail(false);
            if (user.email) {
              await AsyncStorage.setItem('email', user.email);
            }
          } else if (user.verified === true) {
            await setVerifiedEmail(true);
          }

          console.log('Found existing token, setting auth to:', user);
          console.log('Permission data:', {
            role_center_modules: user.role_center_modules,
            permission_sets: user.permission_sets,
            page_permissions: Object.keys(user.page_permissions || {}),
          });
          setAuth(user);
          // Hydrate branch session and align capability flags with JWT.
          await hydrateBranchSession();
          // If JWT carries branch capability flags, persist them to branch session.
          // This keeps gating consistent across restarts.
          await Promise.all([
            AsyncStorage.setItem(
              BRANCH_SESSION_KEYS.enableMultiple,
              user.enable_multiple_branches === true ? '1' : '0',
            ),
            AsyncStorage.setItem(
              BRANCH_SESSION_KEYS.canSwitch,
              user.can_switch_branch === false ? '0' : '1',
            ),
          ]);
          setBranchSessionState((prev) => ({
            ...prev,
            enable_multiple_branches: user.enable_multiple_branches === true,
            can_switch_branch: user.can_switch_branch !== false,
          }));
          const dt = decodedToken as DecodedToken;
          await applyGlobalDimensionFromJwt(dt);
          const jwtBranch = dt.global_dimension_1;
          const jwtHasAssignedBranch = Boolean(
            jwtBranch &&
              Number.isFinite(Number(jwtBranch.id)) &&
              String(jwtBranch.code ?? '').trim().length > 0,
          );
          await ensureBranchSelectionGate({
            enableMultiple: user.enable_multiple_branches === true,
            canSwitch: user.can_switch_branch !== false,
            jwtHasAssignedBranch,
          });
        } catch (error) {
          console.log('Error decoding token, clearing auth state:', error);
          clearAuthState();
          await AsyncStorage.removeItem('accessToken');
        }
      } else {
        console.log('No existing token found');
        await hydrateBranchSession();
      }
    };
    checkAccessToken();
  }, [
    clearAuthState,
    mapTokenToAuthState,
    hydrateBranchSession,
    ensureBranchSelectionGate,
    applyGlobalDimensionFromJwt,
  ]);

  // Load cart items from AsyncStorage on mount
  useEffect(() => {
    const loadCartItems = async () => {
      const storedCartItems = await AsyncStorage.getItem('cartItems');
      if (storedCartItems) {
        setCartItems(JSON.parse(storedCartItems)); // Parse the JSON string
      }
    };
    loadCartItems();
  }, []);

  const login = useCallback(async (userCredentials: {
    email: string;
    password: string;
    tenant?: string;
  }) => {
    try {
      // Get tenant from credentials or from storage and trim it
      const tenant =
        userCredentials.tenant || (await AsyncStorage.getItem('tenant'));
      const cleanTenant = tenant?.trim();
      const userData = await loginUser({
        ...userCredentials,
        tenant: cleanTenant || undefined,
      });
      if (userData && userData.access) {
        const decodedToken = jwtDecode(userData.access) as DecodedToken;
        console.log('Raw decoded token:', decodedToken);
        const user = mapTokenToAuthState(decodedToken);
        console.log('Mapped user data:', user);

        await hydrateSessionFromTokens(userData.access, userData.refresh);

        return userData;
      } else {
        throw new Error('Invalid login response'); // Throw an error if response is invalid
      }
    } catch (error) {
      throw error; // Rethrow the error to be caught in SignIn
    }
  }, [hydrateSessionFromTokens, mapTokenToAuthState]);

  const loginWithTokens = useCallback(
    async (access: string, refresh?: string) => {
      await hydrateSessionFromTokens(access, refresh);
    },
    [hydrateSessionFromTokens],
  );

  const logout = useCallback(async () => {
    // Clear auth state
    setAuth(getEmptyAuthState());
    setBranchSessionState(getEmptyBranchSession());

    // Clear stored data
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userData');
    setCartItems([]);
    await AsyncStorage.removeItem('cartItems');
    await Promise.all([
      AsyncStorage.removeItem(BRANCH_SESSION_KEYS.activeBranch),
      AsyncStorage.removeItem(BRANCH_SESSION_KEYS.activeBranchId),
      AsyncStorage.removeItem(BRANCH_SESSION_KEYS.selectionPending),
      AsyncStorage.removeItem(BRANCH_SESSION_KEYS.enableMultiple),
      AsyncStorage.removeItem(BRANCH_SESSION_KEYS.canSwitch),
      AsyncStorage.removeItem(RESTAURANT_PIN_SETUP_PENDING_KEY),
      AsyncStorage.removeItem(RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY),
      clearRestaurantPinRouteSessionFlags(),
    ]);

    // Force a re-render to trigger navigation changes
    setTimeout(() => {
      setAuth(prevAuth => ({...prevAuth}));
    }, 100);
  }, []);

  // Ensure axios/network layer can force logout (e.g. on 401).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_FORCE_LOGOUT_EVENT, () => {
      logout();
    });
    return () => {
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appContextValue = useMemo(
    () => ({
      auth,
      branchSession,
      login,
      loginWithTokens,
      logout,
      clearAuthState,
      setActiveBranch,
      setBranchSelectionPending,
      refreshBranchCapabilities,
    }),
    [
      auth,
      branchSession,
      clearAuthState,
      login,
      loginWithTokens,
      logout,
      setActiveBranch,
      setBranchSelectionPending,
      refreshBranchCapabilities,
    ],
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <SelectedTabContext.Provider value={selectedTab}>
        <SetSelectedTabContext.Provider value={setSelectedTab}>
          {children}
        </SetSelectedTabContext.Provider>
      </SelectedTabContext.Provider>
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  return useContext(AppContext);
};

export const useSelectedTab = () => {
  return useContext(SelectedTabContext);
};

export const useSetSelectedTab = () => {
  return useContext(SetSelectedTabContext);
};

export const useTabContext = () => {
  return {
    selectedTab: useSelectedTab(),
    setSelectedTab: useSetSelectedTab(),
  };
};

// New useAuth hook
export const useAuth = () => {
  const ctx = useAppContext();
  const auth = ctx?.auth;
  if (!auth) {
    return {
      accessToken: false as const,
      auth: getEmptyAuthState(),
    };
  }
  /** Unverified accounts may receive a JWT for OTP APIs; they must not access the main app. */
  const hasAccessToken = Boolean(
    auth.user_id && auth.username && auth.verified !== false,
  );
  return {accessToken: hasAccessToken, auth};
};
