import React, {useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
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

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Width of the revealed “Delete” strip (matches previous SwipeListView rightOpenValue). */
export const SWIPE_DELETE_STRIP_WIDTH = 104;

const SPRING = {damping: 24, stiffness: 440, mass: 0.45};

const androidDeleteTextFix = Platform.select({
  android: {includeFontPadding: false, textAlignVertical: 'center' as const},
  default: {},
});

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  /** Positive distance (px): releasing at or past this left offset removes the line. */
  fullDeleteThreshold: number;
  deleteBackgroundColor: string;
  deleteTextStyle?: StyleProp<TextStyle>;
  deleteLabel?: string;
  /** Row surface behind the line content (theme surface). */
  surfaceColor: string;
  foregroundStyle?: StyleProp<ViewStyle>;
  borderBottomColor: string;
  /** Row tap (e.g. open editor). Composed with pan so taps are not eaten by the swipe handler on Android. */
  onPress?: () => void;
};

export function SwipeableCartLine({
  children,
  onDelete,
  fullDeleteThreshold,
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

  const triggerDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const runRowPress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        /** Wider dead zone so taps win via Exclusive(tap, pan) before pan activates. */
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onStart(() => {
          startX.value = translateX.value;
        })
        .onUpdate(e => {
          const next = startX.value + e.translationX;
          translateX.value = Math.min(0, Math.max(next, -SCREEN_WIDTH));
        })
        .onEnd(e => {
          const x = translateX.value;
          const vx = e.velocityX;
          const pastCommit =
            x <= -fullDeleteThreshold ||
            (x < -SWIPE_DELETE_STRIP_WIDTH * 0.85 && vx < -900);

          if (pastCommit) {
            runOnJS(triggerDelete)();
            translateX.value = 0;
          } else {
            translateX.value = withSpring(0, SPRING);
          }
        }),
    [fullDeleteThreshold, triggerDelete],
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
    /** Tap has priority: quick tap opens editor; horizontal swipe still goes to pan after tap fails distance. */
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
        style={[styles.deleteTrack, {backgroundColor: deleteBackgroundColor}]}
        pointerEvents="none">
        <View style={styles.deleteStrip}>
          <Text
            style={[styles.deleteTextBase, androidDeleteTextFix, deleteTextStyle]}>
            {deleteLabel}
          </Text>
        </View>
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
  deleteTextBase: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  foreground: {
    width: '100%',
  },
});
