import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {
  createUnitOfMeasure,
  UnitOfMeasure,
  updateUnitOfMeasure,
} from '../../services/app.services';

interface UnitOfMeasureFormModalProps {
  visible: boolean;
  onClose: () => void;
  unit: UnitOfMeasure | null;
  onSave: () => void;
  canCreate: boolean;
  canEdit: boolean;
}

function parseApiError(error: unknown): string {
  const err = error as {
    response?: {data?: {detail?: string; code?: string[]; description?: string[]}};
    message?: string;
  };
  const data = err?.response?.data;
  if (typeof data?.detail === 'string') {
    return data.detail;
  }
  if (Array.isArray(data?.code) && data.code[0]) {
    return String(data.code[0]);
  }
  if (Array.isArray(data?.description) && data.description[0]) {
    return String(data.description[0]);
  }
  return err?.message || 'Something went wrong';
}

const UnitOfMeasureFormModal: React.FC<UnitOfMeasureFormModalProps> = ({
  visible,
  onClose,
  unit,
  onSave,
  canCreate,
  canEdit,
}) => {
  const isEditMode = !!unit;
  const {colors} = useTheme();
  const topInset = useScreenTopInset();
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const theme = useMemo(
    () => ({
      root: {backgroundColor: colors.background},
      title: {color: colors.textPrimary},
      label: {color: colors.textSecondary},
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      inputDisabled: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      help: {color: colors.textSecondary},
      headerIcon: {tintColor: colors.textPrimary},
    }),
    [colors],
  );

  useEffect(() => {
    if (unit) {
      setCode(unit.code || '');
      setDescription(unit.description || '');
    } else {
      setCode('');
      setDescription('');
    }
  }, [unit, visible]);

  const canSave = isEditMode ? canEdit : canCreate;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    const trimmedCode = code.trim().toUpperCase();
    const trimmedDescription = description.trim();
    if (!trimmedCode) {
      Toast.show({type: 'error', text1: 'Code is required'});
      return;
    }
    if (!trimmedDescription) {
      Toast.show({type: 'error', text1: 'Description is required'});
      return;
    }

    setSaving(true);
    try {
      const payload = {code: trimmedCode, description: trimmedDescription};
      if (isEditMode && unit) {
        await updateUnitOfMeasure(unit.code, payload);
        Toast.show({type: 'success', text1: 'Unit updated'});
      } else {
        await createUnitOfMeasure(payload);
        Toast.show({type: 'success', text1: 'Unit created'});
      }
      onSave();
      onClose();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: parseApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, theme.root]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.header, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={onClose}
            style={styles.headerIconButton}
            accessibilityLabel="Close">
            <Image
              source={icons.cross}
              style={[styles.headerIcon, theme.headerIcon]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.headerTitle, theme.title]}>
            {isEditMode ? 'Edit unit' : 'Create unit'}
          </Text>
          {canSave ? (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}>
              {saving ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, theme.label]}>Code</Text>
          <TextInput
            style={[
              styles.input,
              theme.input,
              isEditMode && theme.inputDisabled,
            ]}
            value={code}
            onChangeText={text => setCode(text.toUpperCase())}
            placeholder="e.g. PCS"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            editable={!isEditMode && canSave}
            maxLength={10}
          />
          {isEditMode ? (
            <Text style={[styles.help, theme.help]}>
              Unit code cannot be changed after creation.
            </Text>
          ) : null}

          <Text style={[styles.label, theme.label]}>Description</Text>
          <TextInput
            style={[styles.input, theme.input]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Pieces"
            placeholderTextColor={colors.placeholder}
            editable={canSave}
            maxLength={100}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary3,
  },
  headerTitle: {
    ...FONTS.h3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {width: 48},
  saveBtn: {
    minWidth: 88,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  saveBtnDisabled: {opacity: 0.7},
  saveBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {flex: 1},
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  label: {
    ...FONTS.body5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    ...FONTS.body4,
  },
  help: {
    ...FONTS.body5,
    marginTop: 6,
  },
});

export default UnitOfMeasureFormModal;
