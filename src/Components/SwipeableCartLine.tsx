import React, {useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  Platform,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

/** Width of the revealed “Delete” strip. */
export const SWIPE_DELETE_STRIP_WIDTH = 104;

const SPRING = {damping: 24, stiffness: 440, mass: 0.45};
/** Snap open when released past this fraction of the delete strip. */
const OPEN_SNAP_RATIO = 0.45;

const androidDeleteTextFix = Platform.select({
  android: {includeFontPadding: false, textAlignVertical: 'center' as const},
  default: {},
});

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  /**
   * @deprecated Kept for call-site compatibility. Full-swipe no longer auto-deletes —
   * users swipe to reveal Delete, then tap it (same idea as web Remove).
   */
  fullDeleteThreshold?: number;
  deleteBackgroundColor: string;
  deleteTextStyle?: StyleProp<TextStyle>;
  deleteLabel?: string;
  /** Row surface behind the line content (theme surface). */
  surfaceColor: string;
  foregroundStyle?: StyleProp<ViewStyle>;
  borderBottomColor: string;
  /** Row tap (e.g. open editor). Composed with pan so taps are not eaten by the swipe handler. */
  onPress?: () => void;
};

export function SwipeableCartLine({
  children,
  onDelete,
  deleteBackgroundColor,
  deleteTextStyle,
  deleteLabel = 'Delete',
  surfaceColor,
  foregroundStyle,
  borderBottomColor,
  onPress,
}: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const triggerDelete = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
    isOpen.value = false;
    onDelete();
  }, [onDelete]);

  const closeRow = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
    isOpen.value = false;
  }, []);

  const runRowPress = useCallback(() => {
    if (isOpen.value) {
      closeRow();
      return;
    }
    onPress?.();
  }, [closeRow, onPress]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onStart(() => {
          startX.value = translateX.value;
        })
        .onUpdate(e => {
          const next = startX.value + e.translationX;
          translateX.value = Math.min(0, Math.max(next, -SWIPE_DELETE_STRIP_WIDTH));
        })
        .onEnd(e => {
          const x = translateX.value;
          const vx = e.velocityX;
          const shouldOpen =
            x <= -SWIPE_DELETE_STRIP_WIDTH * OPEN_SNAP_RATIO || vx < -650;

          if (shouldOpen) {
            translateX.value = withSpring(-SWIPE_DELETE_STRIP_WIDTH, SPRING);
            isOpen.value = true;
          } else {
            translateX.value = withSpring(0, SPRING);
            isOpen.value = false;
          }
        }),
    [],
  );

  const gesture = useMemo(() => {
    if (!onPress) {
      return panGesture;
    }
    const tapGesture = Gesture.Tap()
      .maxDistance(20)
      .onEnd(() => {
        runOnJS(runRowPress)();
      });
    return Gesture.Exclusive(tapGesture, panGesture);
  }, [onPress, panGesture, runRowPress]);

  const foregroundAnim = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));

  return (
    <View
      style={[
        styles.rowWrap,
        {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor,
        },
      ]}>
      <View
        style={[styles.deleteTrack, {backgroundColor: deleteBackgroundColor}]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          onPress={triggerDelete}
          style={({pressed}) => [
            styles.deleteStrip,
            pressed && styles.deleteStripPressed,
          ]}>
          <Text
            style={[styles.deleteTextBase, androidDeleteTextFix, deleteTextStyle]}>
            {deleteLabel}
          </Text>
        </Pressable>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          style={[
            {backgroundColor: surfaceColor},
            styles.foreground,
            foregroundStyle,
            foregroundAnim,
          ]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  deleteTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  deleteStrip: {
    width: SWIPE_DELETE_STRIP_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteStripPressed: {
    opacity: 0.85,
  },
  deleteTextBase: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  foreground: {
    width: '100%',
  },
});
