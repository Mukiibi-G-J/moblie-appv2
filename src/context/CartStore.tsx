import React, {createContext, useReducer, useContext} from 'react';
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
      console.log(newItem)
      const cartItems = existItem
        ? state.cartItems.map(item =>
            item.system_id === existItem.system_id ? newItem : item,
          )
        : [...state.cartItems, newItem];

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

export function CartProvider({children}: {children: React.ReactNode}) {
  const [state, dispatchSync] = useReducer(cartReducer, initialState);

  const dispatch = async (action: CartAction) => {
    dispatchSync(action);
    const newState = cartReducer(state, action);

    switch (action.type) {
      case 'CART_ADD_ITEM':
      case 'REMOVE_FROM_CART':
      case 'UPDATE_CART_ITEM_QUANTITY':
      case 'CART_UPDATE_ITEM':
        await AsyncStorage.setItem(
          'cartItems',
          JSON.stringify(newState.cartItems),
        );
        break;
      case 'CLEAR_CART':
        await AsyncStorage.removeItem('cartItems');
        break;
    }
  };

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
      console.log(item);
      dispatch({type: 'CART_ADD_ITEM', payload: item});
    });
  }
}
