import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet, FlatList, ActivityIndicator, Modal, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { COLORS, FONTS, SIZES, icons, images } from '../../constants'
import { Header, IconButton } from '../../Components'
import DropDownPicker from 'react-native-dropdown-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { fetchSalesData, SalesItem } from '../../services/app.services'

const Sales = () => {
    const navigation = useNavigation();
    const [filterOption, setFilterOption] = useState('last7days');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([
        { label: 'Last 7 days', value: 'last7days' },
        { label: 'Last 30 days', value: 'last30days' },
        { label: 'Current year', value: 'currentyear' },
    ]);
    const [salesData, setSalesData] = useState < SalesItem > ([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState < string | null > (null);
    const [selectedItem, setSelectedItem] = useState < SalesItem | null > (null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        loadSalesData();
    }, [startDate, endDate]);

    const loadSalesData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchSalesData({
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            });
            if (data) {
                setSalesData(data);
            }
        } catch (err) {
            setError('Failed to load sales data. Please try again.');
            console.error('Error fetching sales data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    function renderHeader() {
        return (
            <Header
                title="Sales"
                titleStyle={{
                    ...FONTS.h3
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
                    <TouchableOpacity
                        onPress={() => ''}
                    >
                        <Image
                            source={images.person}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 5
                            }}
                        />
                    </TouchableOpacity>
                }
            />
        )
    }

    function renderFilterInputs() {
        return (
            <View style={styles.filterContainer}>
                {/* <View style={styles.inputContainer}>
                    <Text style={styles.label}>Filter</Text>
                    <DropDownPicker
                        open={open}
                        value={filterOption}
                        items={items}
                        setOpen={setOpen}
                        setValue={setFilterOption}
                        setItems={setItems}
                        style={styles.picker}
                        dropDownContainerStyle={styles.dropDownContainer}
                        placeholder=""
                    />
                </View> */}

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Start Date</Text>
                    <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => setShowStartDatePicker(true)}
                    >
                        <Text>{startDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>End Date</Text>
                    <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => setShowEndDatePicker(true)}
                    >
                        <Text>{endDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                </View>

                {showStartDatePicker && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowStartDatePicker(false);
                            if (selectedDate) setStartDate(selectedDate);
                        }}
                    />
                )}

                {showEndDatePicker && (
                    <DateTimePicker
                        value={endDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowEndDatePicker(false);
                            if (selectedDate) setEndDate(selectedDate);
                        }}
                    />
                )}
            </View>
        )
    }

    function renderSalesTable() {
        if (isLoading) {
            return <ActivityIndicator size="large" color={COLORS.primary} />;
        }

        if (error) {
            return <Text style={styles.errorText}>{error}</Text>;
        }

        const totalSales = salesData.reduce((sum, sale) => sum + sale.amount, 0);

        const renderItem = ({ item }) => (
            <TouchableOpacity
                style={styles.tableRow}
                onPress={() => {
                    setSelectedItem(item);
                    setModalVisible(true);
                }}
            >
                <Text style={[styles.tableCell, styles.dateCell]}>{item.date}</Text>
                <Text style={[styles.tableCell, styles.productCell]} numberOfLines={1} ellipsizeMode="tail">
                    {item.item.item_name}
                </Text>
                <Text style={[styles.tableCell, styles.quantityCell]}>{Math.abs(item.quantity)}</Text>
                <Text style={[styles.tableCell, styles.amountCell]}>UGX {item.amount?.toLocaleString()}</Text>
            </TouchableOpacity>
        );

        const renderTableHeader = () => (
            <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.headerCell, styles.dateCell]}>Date</Text>
                <Text style={[styles.tableCell, styles.headerCell, styles.productCell]}>Product</Text>
                <Text style={[styles.tableCell, styles.headerCell, styles.quantityCell]}>Qty</Text>
                <Text style={[styles.tableCell, styles.headerCell, styles.amountCell]}>Amount</Text>
            </View>
        );

        const renderTableFooter = () => (
            <View style={[styles.tableRow, styles.tableFooter]}>
                <Text style={[styles.tableCell, styles.footerCell, { flex: 3 }]}>Total</Text>
                <Text style={[styles.tableCell, styles.footerCell, styles.amountCell]}>UGX {totalSales?.toLocaleString()}</Text>
            </View>
        );

        return (
            <View style={styles.tableContainer}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                    <View>
                        {renderTableHeader()}
                        <FlatList
                            data={salesData}
                            renderItem={renderItem}
                            keyExtractor={item => item.system_id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No sales data found</Text>}
                        />
                        {renderTableFooter()}
                    </View>
                </ScrollView>
            </View>
        );
    }

    function renderItemModal() {
        if (!selectedItem) return null;

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Image
                            source={{ uri: selectedItem.item.item_images[0]?.url }}
                            style={styles.modalImage}
                        />
                        <Text style={styles.modalTitle}>{selectedItem.item.item_name}</Text>
                        <Text style={styles.modalText}>Quantity: {Math.abs(selectedItem.quantity)}</Text>
                        <Text style={styles.modalText}>Unit Price: UGX {selectedItem.unit_amount?.toLocaleString()}</Text>
                        <Text style={styles.modalText}>Total: UGX {selectedItem.amount?.toLocaleString()}</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <View style={styles.container}>
            {renderHeader()}
            {renderFilterInputs()}
            {renderSalesTable()}
            {renderItemModal()}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: SIZES.padding,
        marginTop: SIZES.padding,
        zIndex: 1000 // Ensure the dropdown appears above other elements
    },
    inputContainer: {
        flex: 1,
        marginHorizontal: 5,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.gray2,
        borderRadius: 8,
        paddingTop: 15,
        paddingHorizontal: 10,
        position: 'relative',
    },
    label: {
        position: 'absolute',
        top: -12,
        left: 12,
        backgroundColor: COLORS.white,
        paddingHorizontal: 4,
        fontSize: 14,
        color: COLORS.gray,
        zIndex: 10,
    },
    picker: {
        borderWidth: 0,
        height: 40,
    },
    dropDownContainer: {
        borderColor: COLORS.gray2,
    },
    dateInput: {
        height: 40,
        justifyContent: 'center',
    },
    tableContainer: {
        marginTop: SIZES.padding,
        paddingHorizontal: SIZES.padding,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray2,
        paddingVertical: 10,
        alignItems: 'center',
    },
    tableHeader: {
        backgroundColor: COLORS.lightGray,
    },
    tableFooter: {
        borderTopWidth: 2,
        borderTopColor: COLORS.gray2,
    },
    tableCell: {
        fontSize: 14,
    },
    headerCell: {
        fontWeight: 'bold',
    },
    footerCell: {
        fontWeight: 'bold',
    },
    amountCell: {
        width: 100,
        textAlign: 'right',
    },
    errorText: {
        color: COLORS.red,
        textAlign: 'center',
        marginTop: SIZES.padding,
    },
    dateCell: {
        width: 100,  // Adjust these widths as needed
    },
    productCell: {
        width: 100,
    },
    quantityCell: {
        width: 25,
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: COLORS.white,
        padding: SIZES.padding,
        borderRadius: SIZES.radius,
        alignItems: 'center',
    },
    modalImage: {
        width: 200,
        height: 200,
        marginBottom: SIZES.padding,
    },
    modalTitle: {
        ...FONTS.h2,
        marginBottom: SIZES.base,
    },
    modalText: {
        ...FONTS.body3,
        marginBottom: SIZES.base,
    },
    closeButton: {
        marginTop: SIZES.padding,
        padding: SIZES.base,
        backgroundColor: COLORS.primary,
        borderRadius: SIZES.radius,
    },
    closeButtonText: {
        ...FONTS.h4,
        color: COLORS.white,
    },
});

export default Sales
