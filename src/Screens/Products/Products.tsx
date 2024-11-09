import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, ScrollView, Platform, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { fetchCategories, fetchProducts, updateProduct } from '../../services/app.services';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse, ImageLibraryOptions } from 'react-native-image-picker';

export interface Product {
    id: number;
    system_id: string;
    item_name: string;
    unit_price: number;
    item_images: {
        url: string;
        id: number;
    }[];
    inventory: number;
    category_id: number;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Product[];
}

interface Category {
    id: number;
    name: string;
}

const EditProductModal = ({
    visible,
    onClose,
    product,
    onSave
}: {
    visible: boolean;
    onClose: () => void;
    product: Product | null;
    onSave: (updatedProduct: Product) => void;
}) => {
    const [editedProduct, setEditedProduct] = useState < Product | null > (null);
    const [categories, setCategories] = useState < Category[] > ([]);
    const [selectedImage, setSelectedImage] = useState < any > (null);

    useEffect(() => {
        setEditedProduct(product);
        loadCategories();
    }, [product]);

    const loadCategories = async () => {
        try {
            const response = await fetchCategories();
            setCategories(response.results);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleImagePick = async () => {
        const options: ImageLibraryOptions = {
            mediaType: 'photo',
            quality: 1 as const,
            includeBase64: false,
            maxHeight: 1024,
            maxWidth: 1024,
        };

        try {
            const response = await launchImageLibrary(options);

            if (response.didCancel) {
                return;
            }

            if (response.errorCode) {
                Alert.alert('Error', response.errorMessage || 'Failed to pick image');
                return;
            }

            if (response.assets && response.assets[0] && editedProduct) {
                setEditedProduct({
                    ...editedProduct,
                    item_images: [{
                        ...editedProduct.item_images[0],
                        url: response.assets[0].uri || ''
                    }]
                });
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const handleSave = () => {
        if (editedProduct) {
            onSave(editedProduct);
            onClose();
        }
    };

    if (!editedProduct) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <ScrollView>
                        <Text style={styles.modalTitle}>Edit Product</Text>

                        {/* Image Section */}
                        <View style={styles.imageSection}>
                            <Image
                                source={{
                                    uri: selectedImage?.uri || editedProduct.item_images[0]?.url
                                }}
                                style={styles.productImageLarge}
                            />
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={handleImagePick}
                            >
                                <Text style={styles.buttonText}>Change Image</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Product Name */}
                        <Text style={styles.label}>Product Name</Text>
                        <TextInput
                            style={styles.input}
                            value={editedProduct.item_name}
                            onChangeText={(text) =>
                                setEditedProduct({ ...editedProduct, item_name: text })
                            }
                        />

                        {/* Category Dropdown */}
                        <Text style={styles.label}>Category</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={editedProduct.category_id}
                                onValueChange={(itemValue) =>
                                    setEditedProduct({ ...editedProduct, category_id: itemValue })
                                }
                                style={styles.picker}
                            >
                                {categories.map((category) => (
                                    <Picker.Item
                                        key={category.id}
                                        label={category.name}
                                        value={category.id}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {/* Price */}
                        <Text style={styles.label}>Price</Text>
                        <TextInput
                            style={styles.input}
                            value={String(editedProduct.unit_price)}
                            onChangeText={(text) =>
                                setEditedProduct({
                                    ...editedProduct,
                                    unit_price: parseFloat(text) || 0
                                })
                            }
                            keyboardType="numeric"
                        />

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={onClose}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton]}
                                onPress={handleSave}
                            >
                                <Text style={styles.buttonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const Products = () => {
    const [selectedImage, setSelectedImage] = useState < string | null > (null);
    const [editModal, setEditModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState < Product | null > (null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [products, setProducts] = useState < Product[] > ([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const itemsPerPage = 10;

    const loadProducts = async () => {
        try {
            setLoading(true);
            const response: PaginatedResponse = await fetchProducts(currentPage, searchQuery);
            setProducts(response.results);
            setTotalPages(Math.ceil(response.count / itemsPerPage));
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            loadProducts();
        }, 500); // Debounce search

        return () => clearTimeout(debounceTimer);
    }, [currentPage, searchQuery]);

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        setCurrentPage(1); // Reset to first page when searching
    };

    const renderPagination = () => (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
            >
                <Text style={{ color: '#000000' }}>Previous</Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
                style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
            >
                <Text style={{ color: '#000000' }}>Next</Text>
            </TouchableOpacity>
        </View>
    );

    const handleEditProduct = (product: Product) => {
        setSelectedProduct(product);
        setEditModal(true);
    };

    const renderItem = ({ item }: { item: Product }) => (
        <View style={styles.tableRow}>
            <View style={styles.imageColumn}>
                <TouchableOpacity onPress={() => setSelectedImage(item.item_images[0]?.url)}>
                    <Image
                        source={{ uri: item.item_images[0]?.url }}
                        style={styles.productImage}
                    />
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.nameColumn}
                onPress={() => handleEditProduct(item)}
            >
                <Text style={styles.productName}>{item.item_name}</Text>
            </TouchableOpacity>

            <View style={styles.qtyColumn}>
                <Text style={styles.qty}>{item.inventory}</Text>
            </View>

            <View style={styles.priceColumn}>
                <Text style={styles.price}>UGX{item.unit_price}</Text>
            </View>
        </View>
    );

    const handleImagePick = async () => {
        const options = {
            mediaType: 'photo' as const,
            quality: 1,
            includeBase64: false,
            maxHeight: 1024,
            maxWidth: 1024,
        };

        try {
            const response: ImagePickerResponse = await launchImageLibrary(options as ImageLibraryOptions);

            if (response && !response.didCancel) {
                const firstAsset = response.assets?.[0];

                if (firstAsset?.uri && selectedProduct) {

                    setSelectedProduct(prevProduct => {
                        if (!prevProduct || !firstAsset.uri) return null;

                        return {
                            ...prevProduct,
                            item_images: [{
                                url: firstAsset.uri,
                                id: prevProduct.item_images[0]?.id || 0
                            }]
                        };
                    });
                }
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert(
                'Error',
                'Failed to select image. Please try again.'
            );
        }
    };

    const handleSave = async (selectedProduct: Product) => {
        try {
            setEditModal(false);
            const response = await updateProduct(selectedProduct.id, selectedProduct);
            console.log(response.status);
            if (response.status === 200) {
                Alert.alert('Success', 'Product updated successfully');
                // Reload products
                loadProducts(); 
            } else {
                Alert.alert('Error', 'Failed to update product');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            Alert.alert('Error', 'Failed to save product');
        }
    };

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                value={searchQuery}
                onChangeText={handleSearch}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
            ) : (
                <FlatList
                    data={products}
                    renderItem={renderItem}
                    keyExtractor={item => item.system_id}
                    ListHeaderComponent={TableHeader}
                    ListFooterComponent={renderPagination}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Image Preview Modal */}
            <Modal visible={!!selectedImage} transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    onPress={() => setSelectedImage(null)}
                >
                    <Image
                        source={{ uri: selectedImage || '' }}
                        style={styles.enlargedImage}
                    />
                </TouchableOpacity>
            </Modal>

            {/* Edit Product Modal */}
            <Modal
                visible={editModal}
                transparent
                animationType="slide"
                onRequestClose={() => setEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Product</Text>

                        {selectedProduct && (
                            <ScrollView>
                                {/* Image Section */}
                                <View style={styles.imageSection}>
                                    <Image
                                        source={{
                                            uri: selectedProduct.item_images[0]?.url || 'https://via.placeholder.com/200'
                                        }}
                                        style={styles.editImage}
                                        onError={(error) => console.log('Image loading error:', error)}
                                    />
                                    <TouchableOpacity
                                        style={styles.imagePickerButton}
                                        onPress={handleImagePick}
                                    >
                                        <Text style={styles.imagePickerText}>Change Image</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Product Name */}
                                <Text style={styles.label}>Product Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={selectedProduct.item_name}
                                    onChangeText={(text) =>
                                        setSelectedProduct(prev => prev ? { ...prev, item_name: text } : prev)
                                    }
                                />

                                {/* Price */}
                                <Text style={styles.label}>Price</Text>
                                <TextInput
                                    style={styles.input}
                                    value={String(selectedProduct.unit_price)}
                                    keyboardType="numeric"
                                    onChangeText={(text) =>
                                        setSelectedProduct(prev =>
                                            prev ? { ...prev, unit_price: parseFloat(text) || 0 } : prev
                                        )
                                    }
                                />

                                {/* Buttons */}
                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.cancelButton]}
                                        onPress={() => setEditModal(false)}
                                    >
                                        <Text style={styles.buttonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.saveButton]}
                                        onPress={() => handleSave(selectedProduct)}
                                    >
                                        <Text style={styles.buttonText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const TableHeader = () => (
    <View style={styles.tableHeader}>
        <View style={styles.imageColumn}>
            <Text style={styles.headerText}>Image</Text>
        </View>
        <View style={styles.nameColumn}>
            <Text style={styles.headerText}>Product Name</Text>
        </View>
        <View style={styles.qtyColumn}>
            <Text style={styles.headerText}>Qty</Text>
        </View>
        <View style={styles.priceColumn}>
            <Text style={styles.headerText}>Price</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: 'white',
    },
    tableHeader: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    tableRow: {
        flexDirection: 'row',
        padding: 10,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: 'white',
    },
    imageColumn: {
        width: 70,
        justifyContent: 'center',
    },
    nameColumn: {
        flex: 1,
        paddingHorizontal: 10,
    },
    qtyColumn: {
        width: 40,
        alignItems: 'center',
    },
    priceColumn: {
        width: 80,
        alignItems: 'flex-end',
    },
    productImage: {
        width: 50,
        height: 50,
        borderRadius: 5,
    },
    productName: {
        fontSize: 14,
        color: '#000000',
    },
    price: {
        fontSize: 14,
        color: '#000000',
    },
    headerText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#000000',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    enlargedImage: {
        width: '90%',
        height: '90%',
        resizeMode: 'contain',
    },
    editContainer: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#000000',
    },
    closeButton: {
        marginTop: 15,
        padding: 10,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        borderRadius: 5,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 16,
        color: '#000000',
        backgroundColor: 'white',
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    pageButton: {
        padding: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
    },
    disabledButton: {
        opacity: 0.5,
    },
    pageInfo: {
        fontSize: 14,
        color: '#000000',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qty: {
        fontSize: 14,
        color: '#000000',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '90%',
        maxHeight: '90%',
    },
    imageSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    productImageLarge: {
        width: 200,
        height: 200,
        borderRadius: 10,
        marginBottom: 10,
    },
    imagePickerButton: {
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 5,
        marginTop: 10,
    },
    imagePickerText: {
        color: 'white',
        fontWeight: 'bold',
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 5,
        color: '#000000',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
        color: '#000000',
        backgroundColor: 'white',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        marginBottom: 15,
    },
    picker: {
        height: 50,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    button: {
        flex: 1,
        padding: 15,
        borderRadius: 5,
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#ff4444',
    },
    saveButton: {
        backgroundColor: '#4CAF50',
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    editImage: {
        width: 200,
        height: 200,
        borderRadius: 10,
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
    },
});

export default Products;