import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

// Stand-in for real RFID/camera scanning (out of scope this pass — see plan).
// Operator types or pastes an EPC for now; swap the trailing icon's onPress
// for a camera/BLE reader flow later without changing the call sites below.
export function ScannerInput({ value, onChangeText, onSubmit, placeholder = 'กรอกรหัส EPC', ...props }) {
  // Ready badge shows while the field is empty and enabled — the moment a handheld
  // scan (keyboard-wedge input into this field) is actually expected. It clears once
  // a value lands so it never competes with a result the operator is reading.
  const ready = !props.disabled && !value;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready) return undefined;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ready, pulse]);

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });

  return (
    <View style={styles.wrapper}>
      {ready ? (
        <View style={styles.readyBadge}>
          <Animated.View style={{ opacity: pulseOpacity, transform: [{ scale: pulseScale }] }}>
            <MaterialCommunityIcons name="cellphone-wireless" size={13} color={sage.text} />
          </Animated.View>
          <Animated.Text style={[type.caption, styles.readyText, { opacity: pulseOpacity }]}>
            พร้อมสแกน
          </Animated.Text>
        </View>
      ) : null}
      <TextInput
        mode="outlined"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        outlineColor={brand.grey[300]}
        activeOutlineColor={brand.primary.main}
        style={styles.input}
        right={<TextInput.Icon icon="barcode-scan" onPress={onSubmit} color={brand.primary.dark} />}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  input: {
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    height: 58,
  },
  // Floats above the input's top-right corner like a live status chip — reads as
  // "this field is armed" without adding vertical space or fighting Paper's
  // TextInput.Icon adornment slot (too small/clipped to host an animation cleanly).
  readyBadge: {
    position: 'absolute',
    top: -12,
    right: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: sage.tint,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  readyText: {
    color: sage.text,
    fontSize: 11,
    lineHeight: 13,
  },
});
