import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { useScanReady } from '../context/ScanReadyContext';
import { brand } from '../theme/colors';
import { radius } from '../theme/theme';

// Stand-in for real RFID/camera scanning (out of scope this pass — see plan).
// Operator types or pastes an EPC for now; swap the trailing icon's onPress
// for a camera/BLE reader flow later without changing the call sites below.
export function ScannerInput({ value, onChangeText, onSubmit, placeholder = 'กรอกรหัส EPC', ...props }) {
  // Publishes readiness to the app-wide ScanReadyContext instead of rendering its own
  // badge — app/(app)/_layout.jsx shows the actual "พร้อมสแกน" indicator floating over
  // the home tab, one shared spot regardless of which screen's field is currently armed.
  const { setScanReady } = useScanReady();
  const ready = !props.disabled && !value;

  useEffect(() => {
    setScanReady(ready);
    return () => setScanReady(false);
  }, [ready, setScanReady]);

  return (
    <View style={styles.wrapper}>
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
  },
  input: {
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    height: 58,
  },
});
