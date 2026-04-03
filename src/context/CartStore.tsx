import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import {InteractionManager} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {CartItem, CartState, CartAction} from '../@types/types.dto';

const CartContext = createContext<
  | {
      state: CartState;
      dispatch: (action: CartAction) => Promise<void>;
    }
  | undefined
>(undefined);

const initialState: CartState = {
  cartItems: [],
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'CART_ADD_ITEM': {
      const newItem = action.payload;
      const existItem = state.cartItems.find(
        item => item.system_id === newItem.system_id,
      );

      const mergedItem = existItem
        ? {
            ...existItem,
            ...newItem,
            tracking_code:
              newItem.tracking_code !== undefined
                ? newItem.tracking_code
                : existItem.tracking_code,
            selectedTrackingCode:
              newItem.selectedTrackingCode !== undefined
                ? newItem.selectedTrackingCode
                : existItem.selectedTrackingCode ?? null,
            trackingDetails:
              newItem.trackingDetails !== undefined
                ? newItem.trackingDetails
                : existItem.trackingDetails,
          }
        : newItem;

      const cartItems = existItem
        ? state.cartItems.map(item =>
            item.system_id === existItem.system_id ? mergedItem : item,
          )
        : [...state.cartItems, mergedItem];

      return {...state, cartItems};
    }

    case 'REMOVE_FROM_CART': {
      const cartItems = state.cartItems.filter(
        item => item.system_id !== action.payload.system_id,
      );
      return {...state, cartItems};
    }

    case 'UPDATE_CART_ITEM_QUANTITY': {
      const cartItems = state.cartItems.map(item =>
        item.system_id === action.payload.system_id
          ? {...item, quantity: action.payload.quantity}
          : item,
      );
      return {...state, cartItems};
    }

    case 'CART_UPDATE_ITEM': {
      const cartItems = state.cartItems.map(item =>
        item.system_id === action.payload.system_id ? action.payload : item,
      );
      return {...state, cartItems};
    }

    case 'CLEAR_CART': {
      return {...state, cartItems: []};
    }

    default:
      return state;
  }
}

const CART_PERSIST_DEBOUNCE_MS = 450;

export function CartProvider({children}: {children: React.ReactNode}) {
  const [state, dispatchSync] = useReducer(cartReducer, initialState);
  const hasPersistedInitialStateRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCartItemsRef = useRef(state.cartItems);
  latestCartItemsRef.current = state.cartItems;

  useEffect(() => {
    if (!hasPersistedInitialStateRef.current) {
      hasPersistedInitialStateRef.current = true;
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const items = latestCartItemsRef.current;

      InteractionManager.runAfterInteractions(() => {
        void (async () => {
          try {
            if (items.length === 0) {
              await AsyncStorage.removeItem('cartItems');
              return;
            }

            await AsyncStorage.setItem('cartItems', JSON.stringify(items));
          } catch (error) {
            console.error('Failed to persist cart items:', error);
          }
        })();
      });
    }, CART_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [state.cartItems]);

  const dispatch = useCallback((action: CartAction) => {
    dispatchSync(action);
    return Promise.resolve();
  }, []);

  return (
    <CartContext.Provider value={{state, dispatch}}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export async function initializeCart(dispatch: React.Dispatch<CartAction>) {
  const storedCartItems = await AsyncStorage.getItem('cartItems');
  if (storedCartItems) {
    const cartItems = JSON.parse(storedCartItems);
    cartItems.forEach((item: CartItem) => {
      dispatch({type: 'CART_ADD_ITEM', payload: item});
    });
  }
}
