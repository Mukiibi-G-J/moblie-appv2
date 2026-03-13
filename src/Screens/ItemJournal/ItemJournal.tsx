import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { fetchItemJournal, updateItemJournal } from '../../services/app.services';
import { COLORS, FONTS, SIZES } from '../../constants';
import Toast from 'react-native-toast-message';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

interface ItemJournal {
    id: number;
    system_id: string;
    item: number;
    item_name: string;
    entry_type: string;
    document_no: string;
    description: string;
    quantity: number;
    total: number;
    unit_amount: number | null;
    date: string;
    user: number;
    unit_cost: number;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: ItemJournal[];
}

const EditJournalModal = ({
    visible,
    onClose,
    journal,
    onSave,
    canEdit
}: {
    visible: boolean;
    onClose: () => void;
    journal: ItemJournal | null;
    onSave: (updatedJournal: ItemJournal) => void;
    canEdit: boolean;
}) => {
    const [editedJournal, setEditedJournal] = useState < ItemJournal | null > (null);

    useEffect(() => {
        setEditedJournal(journal);
    }, [journal]);

    const handleSave = () => {
        if (editedJournal) {
            onSave(editedJournal);
            onClose();
        }
    };

    if (!editedJournal) return null;

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
                        <Text style={styles.modalTitle}>Edit Journal Entry</Text>

                        {/* Item Name (read-only) */}
                        <Text style={styles.label}>Item Name</Text>
                        <Text style={styles.readOnlyText}>{editedJournal.item_name}</Text>

                        {/* Quantity */}
                        <Text style={styles.label}>Quantity</Text>
                        <TextInput
                            style={styles.input}
                            value={String(editedJournal.quantity)}
                            onChangeText={(text) =>
                                setEditedJournal({
                                    ...editedJournal,
                                    quantity: parseFloat(text) || 0
                                })
                            }
                            keyboardType="numeric"
                        />

                        {/* Unit Cost */}
                        <Text style={styles.label}>Unit Cost</Text>
                        <TextInput
                            style={styles.input}
                            value={String(editedJournal.unit_cost)}
                            onChangeText={(text) =>
                                setEditedJournal({
                                    ...editedJournal,
                                    unit_cost: parseFloat(text) || 0
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
                            {canEdit && (
                                <TouchableOpacity
                                    style={[styles.button, styles.saveButton]}
                                    onPress={handleSave}
                                >
                                    <Text style={styles.buttonText}>Save</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const ItemJournal = () => {
    const {canRead, canEdit} = usePermissions();
    const PAGE_NAME = PAGE_NAMES.ITEM_JOURNAL;

    // Early return if no read permission
    if (!canRead(PAGE_NAME)) {
        return (
            <View style={styles.container}>
                <View style={styles.accessDeniedContainer}>
                    <Text style={styles.accessDeniedTitle}>Access Denied</Text>
                    <Text style={styles.accessDeniedMessage}>
                        You don't have permission to view item journal.
                    </Text>
                </View>
            </View>
        );
    }

    const [editModal, setEditModal] = useState(false);
    const [selectedJournal, setSelectedJournal] = useState < ItemJournal | null > (null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [journals, setJournals] = useState < ItemJournal[] > ([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const itemsPerPage = 10;

    const loadJournals = async () => {
        try {
            setLoading(true);
            const response = await fetchItemJournal(currentPage, searchQuery);
            console.log('response', response.results);
            setJournals(response.results);
            setTotalPages(Math.ceil(response.count / itemsPerPage));
        } catch (error) {
            console.error('Error fetching journals:', error);
            Toast.show({
                text1: 'Failed to load journal entries',
                type: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            setCurrentPage(1);
            loadJournals();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    useEffect(() => {
        if (searchQuery === '') {
            loadJournals();
        }
    }, [currentPage]);

    const handleEditJournal = (journal: ItemJournal) => {
        // Check permission before opening edit modal
        if (!canEdit(PAGE_NAME)) {
            Alert.alert(
                'Access Denied',
                'You do not have permission to edit journal entries.',
            );
            return;
        }
        setSelectedJournal(journal);
        setEditModal(true);
    };

    const handleSave = async (updatedJournal: ItemJournal) => {
        try {
            console.log('updatedJournal', updatedJournal);
            const response = await updateItemJournal(updatedJournal.id, {
                quantity: updatedJournal.quantity,
                unit_cost: updatedJournal.unit_cost,
                // description: updatedJournal.description,
                // entry_type: updatedJournal.entry_type,
                // item: updatedJournal.item,
                // date: updatedJournal.date
            });


            if (response.status === 200) {
                Toast.show({
                    text1: 'Journal entry updated successfully',
                    type: 'success',
                });
                setEditModal(false);
                loadJournals(); // Reload the list
            } else {
                Toast.show({
                    text1: 'Failed to update journal entry',
                    type: 'error',
                });
            }
        } catch (error) {
            console.error('Error saving journal:', error);
            Toast.show({
                text1: 'Failed to save journal entry',
                type: 'error',
            });
        }
    };

    const renderItem = ({ item }: { item: ItemJournal }) => (
        <TouchableOpacity
            style={[
                styles.tableRow,
                !canEdit(PAGE_NAME) && styles.disabledRow
            ]}
            onPress={() => handleEditJournal(item)}
            disabled={!canEdit(PAGE_NAME)}
        >
            <View style={styles.docColumn}>
                <Text style={styles.text}>{item.document_no}</Text>
            </View>
            <View style={styles.nameColumn}>
                <Text style={styles.text}>{item.item_name}</Text>
            </View>
            <View style={styles.qtyColumn}>
                <Text style={styles.text}>{item.quantity}</Text>
            </View>
            <View style={styles.costColumn}>
                <Text style={styles.text}>UGX{item.unit_cost}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderPagination = () => (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
            >
                <Text style={styles.pageButtonText}>Previous</Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
                style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
                onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
            >
                <Text style={styles.pageButtonText}>Next</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search journals..."
                placeholderTextColor={COLORS.gray}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
            ) : journals.length === 0 ? (
                <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                        {searchQuery ? 'No results found' : 'No journal entries available'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={journals}
                    renderItem={renderItem}
                    keyExtractor={item => item.system_id}
                    ListHeaderComponent={TableHeader}
                    ListFooterComponent={renderPagination}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <EditJournalModal
                visible={editModal}
                onClose={() => setEditModal(false)}
                journal={selectedJournal}
                onSave={handleSave}
                canEdit={canEdit(PAGE_NAME)}
            />
            <Toast />

        </View>

    );
};

const TableHeader = () => (
    <View style={styles.tableHeader}>
        <View style={styles.docColumn}>
            <Text style={styles.headerText}>DocNo</Text>
        </View>
        <View style={styles.nameColumn}>
            <Text style={styles.headerText}>Item Name</Text>
        </View>
        <View style={styles.qtyColumn}>
            <Text style={styles.headerText}>Qty</Text>
        </View>
        <View style={styles.costColumn}>
            <Text style={styles.headerText}>Cost</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: 'white',
    },
    accessDeniedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: COLORS.white,
        margin: 16,
        borderRadius: SIZES.radius,
    },
    accessDeniedTitle: {
        ...FONTS.h2,
        color: COLORS.error,
        marginBottom: SIZES.base,
        textAlign: 'center',
    },
    accessDeniedMessage: {
        ...FONTS.body3,
        color: COLORS.gray,
        textAlign: 'center',
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
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: 'white',
    },
    disabledRow: {
        opacity: 0.5,
    },
    docColumn: {
        width: 70,
    },
    nameColumn: {
        flex: 4,
        paddingHorizontal: 10,
    },
    qtyColumn: {
        width: 50,
        alignItems: 'center',
    },
    costColumn: {
        width: 80,
        alignItems: 'flex-end',
    },
    headerText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: COLORS.gray,
    },
    text: {
        color: COLORS.gray,
        fontSize: 14,
    },
    searchInput: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 16,
        color: COLORS.gray,
        backgroundColor: 'white',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '90%',
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: COLORS.gray,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 5,
        color: COLORS.gray,
    },
    readOnlyText: {
        fontSize: 16,
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 5,
        marginBottom: 15,
        color: COLORS.gray,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
        color: COLORS.gray,
        backgroundColor: 'white',
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
        color: COLORS.gray,
    },
    pageButtonText: {
        color: COLORS.gray,
    },
    noResultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
    },
    noResultsText: {
        color: COLORS.gray,
        fontSize: 16,
    },
});

export default ItemJournal;
