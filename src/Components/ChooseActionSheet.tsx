import React, {useCallback, useRef} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, FONTS} from '../constants';
import {useTheme} from '../context/ThemeContext';

export type ChooseActionItem = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type ChooseActionSheetProps = {
  visible: boolean;
  title?: string;
  actions: ChooseActionItem[];
  onClose: () => void;
  emptyText?: string;
};

const ChooseActionSheet: React.FC<ChooseActionSheetProps> = ({
  visible,
  title,
  actions,
  onClose,
  emptyText,
}) => {
  const {colors} = useTheme();

  /**
   * iOS cannot present another modal (edit form, alert, picker) while this one is
   * still fading out; doing so leaves an invisible layer that blocks all touches.
   * On iOS the chosen action is parked here and run from Modal.onDismiss, with a
   * timeout fallback in case the parent unmounts the sheet instead of hiding it.
   */
  const pendingActionRef = useRef<(() => void) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPendingAction = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    pending?.();
  }, []);

  const handleActionPress = useCallback(
    (action: ChooseActionItem) => {
      if (Platform.OS === 'ios') {
        pendingActionRef.current = action.onPress;
        fallbackTimerRef.current = setTimeout(runPendingAction, 600);
        onClose();
        return;
      }
      onClose();
      // Defer so the modal can dismiss before the action opens another UI.
      requestAnimationFrame(() => {
        action.onPress();
      });
    },
    [onClose, runPendingAction],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onDismiss={runPendingAction}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}
          onPress={e => e.stopPropagation()}>
          {title ? (
            <Text
              style={[styles.title, {color: colors.textPrimary}]}
              numberOfLines={2}>
              {title}
            </Text>
          ) : null}

          {actions.length === 0 ? (
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              {emptyText || 'No actions available.'}
            </Text>
          ) : (
            actions.map((action, index) => (
              <TouchableOpacity
                key={action.key}
                style={[
                  styles.actionRow,
                  index < actions.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => handleActionPress(action)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}>
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color: action.destructive
                        ? COLORS.red || '#D32F2F'
                        : colors.textPrimary,
                    },
                  ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={[
              styles.cancelBtn,
              {backgroundColor: colors.inputBackground || COLORS.lightGray2},
            ]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel">
            <Text style={[styles.cancelLabel, {color: colors.textPrimary}]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    ...FONTS.h4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emptyText: {
    ...FONTS.body4,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  actionRow: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  actionLabel: {
    ...FONTS.h5,
  },
  cancelBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: {
    ...FONTS.h5,
  },
});

export default ChooseActionSheet;
