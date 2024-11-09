import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    ActivityIndicator,
    ScrollView,
    Modal,
    Button
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { createSales, postItemJournal, searchItems } from '../../services/app.services';
import Toast from 'react-native-toast-message';
import ReactNativeModal from "react-native-modal";
import { Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from 'react-native';

import { FONTS, SIZES, COLORS, icons, dummyData } from "../../constants"
import { CartQuantityButton, FooterTotal, Header, IconButton, StepperInput } from '../../Components';
import { useAppContext } from '../../context/Store';
import { useCart } from '../../context/CartStore';
import { useIsFocused } from '@react-navigation/native';
import { handlePrint } from '../../Components/HandlePrint';
import { SalesPostData } from '../../@types/types.dto';

// Updated CartItem type
type CartItem = {
    bar_code_no: string;
    system_id: string;
    item_name: string;
    inventory: number;
    unit_price: number;
    item_images: {
        id: number;
        created_at: string;
        system_id: string;
        updated_at: string;
        alt_text: string;
        url: string;
        item: number;
    }[];
    quantity: number;
};

const Cart = ({ navigation }: { navigation: any }) => {

    const [myCartList, setMyCartList] = React.useState(dummyData.myCart);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalItems, setModalItems] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [printReceipt, setPrintReceipt] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [isPriceModalVisible, setPriceModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const colorScheme = useColorScheme();

    const searchInputRef = useRef < TextInput > (null);
    const { state, dispatch } = useCart();
    const { auth } = useAppContext();
    const { cartItems } = state;
    const isFocused = useIsFocused();
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    useEffect(() => {
        if (isFocused) {
            // Use a small delay to ensure the input is rendered
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isFocused]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    const addToCart = (item: CartItem) => {
        const existItem = cartItems.find((x: CartItem) => x.system_id === item.system_id);
        const quantity = existItem ? existItem.quantity + 1 : 1;

        if (quantity > item.inventory) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Sorry, only ${item.inventory} items available in stock.`,
            });
            return;
        }

        dispatch({ type: 'CART_ADD_ITEM', payload: { ...item, quantity } });
        setSearchQuery('');
        searchInputRef.current?.focus();
        // Toast.show({
        //     type: 'success',
        //     text1: 'Added to Cart',
        //     text2: `${item.item_name} added to your cart.`,
        // });
        // Toast.success(`${item.item_name} added to your cart.`);
    };

    const handleSearch = async (itemCode: string) => {
        setIsLoading(true);
        try {
            if (!itemCode.trim()) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Please enter a search query.',
                });
                return;
            }
            const results = await searchItems(itemCode);

            if (results.length === 1) {
                addToCart(results[0]);
            } else if (results.length > 1) {
                setModalItems(results);
                toggleModal();
                setSearchQuery('');
            } else {
                Toast.show({
                    type: 'info',
                    text1: 'No Results',
                    text2: 'No items found for your search.',
                });
            }
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Error: ${error}`,
            });
        } finally {
            setIsLoading(false);
            setSearchQuery('');
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    };

    function renderSearch() {
        return (
            <View
                style={{
                    flexDirection: 'row',
                    height: 40,
                    alignItems: 'center',
                    marginHorizontal: SIZES.padding,
                    marginVertical: SIZES.base,
                    paddingHorizontal: SIZES.radius,
                    borderRadius: SIZES.radius,
                    backgroundColor: COLORS.lightGray2
                }}
            >
                {/* Icon */}
                <Image
                    source={icons.search}
                    style={{
                        height: 20,
                        width: 20,
                        tintColor: COLORS.black
                    }}
                />

                <TextInput
                    ref={searchInputRef}
                    style={{
                        flex: 1,
                        marginLeft: SIZES.radius,
                        color: COLORS.black,

                        ...FONTS.body3
                    }}
                    placeholder="Scan barcode..."
                    placeholderTextColor={COLORS.gray}
                    value={searchQuery}
                    onChangeText={(itemCode) => {
                        //first check it it contains only numbers
                        if (/^\d*$/.test(itemCode)) {

                            if (itemCode.length === 13) {
                                setSearchQuery(itemCode);
                                handleSearch(itemCode);
                            }
                            //if  it contains alphabets
                        } else if (/^[a-zA-Z]+$/.test(itemCode)) {
                            setSearchQuery(itemCode);
                        }
                    }}
                    onSubmitEditing={() => handleSearch(searchQuery)}
                    editable={!isLoading}
                    returnKeyType="search"
                />

                {/* Submit Button */}
                <TouchableOpacity
                    onPress={() => handleSearch(searchQuery)}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primary2} />
                    ) : (
                        <Text style={{ color: COLORS.primary2, ...FONTS.h3 }}>Submit</Text>
                    )}
                </TouchableOpacity>
            </View>
        )
    }

    const updateQuantityHandler = (systemId: string, newQty: number) => {
        const existItem = cartItems.find((x: { system_id: string }) => x.system_id === systemId);

        if (existItem) {
            if (newQty > existItem.inventory) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: `Sorry, only ${existItem.inventory} items available in stock.`,
                });
                return;
            }

            dispatch({
                type: 'CART_ADD_ITEM',
                payload: { ...existItem, quantity: newQty },
            });
        } else {
            console.error("Item not found in cart:", systemId);
        }
    };


    function toggleModal() {
        setIsModalVisible(!isModalVisible); // This toggles the modal visibility
    }

    function renderHeader() {
        return (
            <Header
                title="CART"
                titleStyle={{
                    ...FONTS.h3,
                    color: COLORS.black
                }}
                containerStyle={{
                    height: 50,
                    marginHorizontal: SIZES.padding,
                    marginTop: 40
                }}
                leftComponent={
                    <IconButton
                        icon={icons.back}
                        containerStyle={{
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderRadius: SIZES.radius,
                            borderColor: COLORS.gray2,
                        }}
                        iconStyle={{
                            width: 20,
                            height: 20,
                            tintColor: COLORS.gray2
                        }}
                        onPress={() => navigation.goBack()}
                    />
                }
                rightComponent={
                    <CartQuantityButton
                        quantity={3}
                    />
                }
            />
        )
    }

    const handlePlaceOrder = async (total: number) => {
        if (isPlacingOrder) return;

        setIsPlacingOrder(true);

        try {
            let data: SalesPostData[] = []
            cartItems.forEach(item => {
                data.push({
                    item: item.id,
                    entry_type: "Sales",
                    description: item.item_name,
                    quantity: item.quantity,
                    unit_amount: item.unit_price,
                    date: new Date().toISOString().split('T')[0],
                    user: auth.user_id
                })
            })
            if (data.length > 0) {
                console.log(data)
                const response = await createSales(data)
                if (response.status === 201) {
                    const journal_ids = response.data.map((item: any) => item.id);
                    const journal_data = {
                        "journal_ids": journal_ids
                    }
                    const responsePostItemJournal = await postItemJournal(journal_data)
                    if ('status' in responsePostItemJournal && responsePostItemJournal.status === 200) {
                        Toast.show({
                            type: 'success',
                            text1: 'Sales Created',
                            text2: 'Sales have been created successfully.',
                        });
                        dispatch({ type: 'CLEAR_CART' })
                    } else {
                        Toast.show({
                            type: 'error',
                            text1: 'Error',
                            text2: 'Failed to create sales. Please try again.',
                        });
                    }
                } else if (response.data.status === "400") {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to create sales. Please try again.',
                    });
                }
            }

            if (printReceipt) {
                await handlePrint(cartItems, total, auth.username)
            }
            await new Promise(resolve => setTimeout(resolve, 2000));

            Toast.show({
                type: 'success',
                text1: 'Order Placed',
                text2: 'Your order has been placed successfully.',
            });



        } catch (error) {
            console.error('Error placing order:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to place order. Please try again.',
            });
        } finally {
            setIsPlacingOrder(false);
        }
    }

    function renderFooter() {
        const subQuantity = cartItems.reduce((a: number, c: { quantity: number }) => a + c.quantity, 0)
        const subTotal = cartItems.reduce((sum: number, item: { unit_price: number; quantity: number }) => sum + item.unit_price * item.quantity, 0);
        const total = subTotal;
        return (
            <FooterTotal
                subTotal={subTotal}
                totalQuantity={subQuantity}
                total={total}
                printReceipt={printReceipt}
                setPrintReceipt={setPrintReceipt}
                onPress={() => handlePlaceOrder(total)}
                isLoading={isPlacingOrder}
            />
        )
    }

    const ModalPopup = () => (
        <ReactNativeModal
            isVisible={isModalVisible}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            onBackdropPress={toggleModal}
        >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                <View style={{ width: '90%', maxHeight: '75%', backgroundColor: 'white', borderRadius: 10, padding: 16 }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: COLORS.gray }}>Select a Product</Text>
                    <FlatList
                        data={modalItems}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: 'gray' }}
                                onPress={() => {

                                    addToCart(item);

                                    Toast.show({
                                        type: 'success',
                                        text1: 'Item Added',
                                        text2: `${item.item_name} has been added to your cart.`,
                                    });
                                    // } else {
                                    //     Toast.show({
                                    //         type: 'error',
                                    //         text1: 'Error',
                                    //         text2: `Sorry, only ${item.inventory} items available in stock.`,
                                    //     });
                                    // }
                                    toggleModal();
                                }}
                            >
                                <Image
                                    source={{ uri: item.item_images[0]?.url }}
                                    style={{ width: 40, height: 40, borderRadius: 5 }}
                                    resizeMode="cover"
                                />
                                <View style={{ marginLeft: 16 }}>
                                    <Text style={{ fontWeight: '600', color: COLORS.gray }}>
                                        {item.item_name.length > 12
                                            ? `${item.item_name.substring(0, 12)}...`
                                            : item.item_name}
                                    </Text>
                                    <Text style={{ color: 'gray' }}>Stock: {item.inventory}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item.system_id}
                        ListEmptyComponent={
                            <Text style={{ textAlign: 'center', color: 'gray', marginTop: 16 }}>No products found.</Text>
                        }
                    />
                    <TouchableOpacity
                        style={{ marginTop: 16, backgroundColor: 'red', paddingVertical: 8, borderRadius: 5 }}
                        onPress={toggleModal}
                    >
                        <Text style={{ textAlign: 'center', color: 'white', fontWeight: '600' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ReactNativeModal>
    );

    const openPriceModal = (item) => {
        setSelectedItem(item);
        setNewPrice(item.unit_price.toString());
        setSelectedDate(new Date());
        setPriceModalVisible(true);
    };

    const updatePrice = () => {
        if (selectedItem) {
            const updatedItem = {
                ...(selectedItem as CartItem),
                unit_price: parseFloat(newPrice),
                date_sold: selectedDate
            };
            // Update the item in your cart state
            // This will depend on how you're managing state in your app
            // For example, if using useCart hook:
            dispatch({ type: 'CART_UPDATE_ITEM', payload: updatedItem });
        }
        setPriceModalVisible(false);
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || new Date();
        setShowDatePicker(Platform.OS === 'ios');
        setSelectedDate(currentDate);
    };

    const renderPriceModal = () => (
        <Modal
            visible={isPriceModalVisible}
            transparent={true}
            animationType="slide"
        >
            <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? COLORS.darkGray : COLORS.white }]}>
                    <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? COLORS.white : COLORS.black }]}>Update Price</Text>
                    <TextInput
                        style={[styles.input, { color: colorScheme === 'dark' ? COLORS.white : COLORS.black }]}
                        value={newPrice.toLocaleString()}
                        onChangeText={setNewPrice}
                        keyboardType="numeric"
                        placeholder="Enter new price"
                        placeholderTextColor={colorScheme === 'dark' ? COLORS.lightGray : COLORS.gray}
                    />
                    <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={{ color: colorScheme === 'dark' ? COLORS.white : COLORS.black }}>
                            {selectedDate.toDateString()}
                        </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                            themeVariant={colorScheme}
                        />
                    )}
                    <View style={styles.modalButtons}>
                        <Button title="Cancel" onPress={() => setPriceModalVisible(false)} />
                        <Button title="Update" onPress={updatePrice} />
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
                <View style={{ flex: 1 }}>
                    {renderHeader()}
                    {renderSearch()}

                    <SwipeListView
                        data={cartItems}
                        keyExtractor={(item: any) => `${item.system_id}`}
                        renderItem={({ item }: { item: any }) => (
                            <View
                                style={{
                                    height: 100,
                                    backgroundColor: COLORS.lightGray2,
                                    ...styles.cartItemContainer
                                }}
                            >
                                {/* Food Image */}
                                <View style={{ width: 90, height: 100, marginLeft: -10 }}>
                                    <Image
                                        source={item.item_images && item.item_images[0]?.url
                                            ? { uri: item.item_images[0].url }
                                            : icons.product2
                                        }
                                        resizeMode="contain"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            position: 'absolute',
                                            top: 10,
                                        }}
                                    />
                                </View>


                                <View style={{ flex: 1 }}>
                                    <Text style={{ ...FONTS.body3, color: COLORS.gray }}>{item.item_name}</Text>
                                    <TouchableOpacity
                                        onPress={() => openPriceModal(item)}
                                        style={{ padding: 10 }}
                                    >
                                        <Text
                                            style={{ color: COLORS.primary, ...FONTS.h4 }}
                                            onPress={() => openPriceModal(item)} // Add onPress here as well
                                        >
                                            UGX {item.unit_price?.toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Quantity */}
                                <StepperInput
                                    containerStyle={{
                                        height: 50,
                                        width: 125,
                                        backgroundColor: COLORS.white

                                    }}
                                    value={item.quantity}
                                    onAdd={() => updateQuantityHandler(item.system_id, item.quantity + 1)}
                                    onMinus={() => {
                                        if (item.quantity > 1) {
                                            updateQuantityHandler(item.system_id, item.quantity - 1)
                                        }
                                    }}
                                />
                            </View>
                        )}
                        renderHiddenItem={(data, rowMap) => (
                            <IconButton
                                containerStyle={{
                                    flex: 1,
                                    justifyContent: 'flex-end',
                                    backgroundColor: COLORS.primary,
                                    ...styles.cartItemContainer
                                }}
                                icon={icons.delete_icon}
                                iconStyle={{
                                    marginRight: 10
                                }}
                                onPress={() =>
                                    dispatch({ type: 'REMOVE_FROM_CART', payload: data.item })}
                            />
                        )}
                        rightOpenValue={-75}
                        contentContainerStyle={{ flexGrow: 1 }}
                        ListEmptyComponent={
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ ...FONTS.h3, color: COLORS.gray }}>Your cart is empty</Text>
                            </View>
                        }
                    />
                </View>

                {/* Footer */}
                {cartItems.length > 0 && !isKeyboardVisible && (
                    <View style={styles.footerContainer}>
                        {renderFooter()}
                    </View>
                )}
            </KeyboardAvoidingView>
            {isPlacingOrder && (
                <ActivityIndicator
                    size="large"
                    color={COLORS.primary2}
                    style={{ position: 'absolute', top: '50%', left: '50%' }}
                />
            )}
            {/* Modal Popup */}
            <ModalPopup />
            {renderPriceModal()}
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    cartItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SIZES.radius,
        paddingHorizontal: SIZES.radius,
        borderRadius: SIZES.radius,
    },
    footerContainer: {
        backgroundColor: COLORS.white,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10,
    },
    datePickerButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
});

export default Cart;
