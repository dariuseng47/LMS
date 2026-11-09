import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { OTHER_REASON_MAX_LENGTH, REASON_CODE_OPTIONS } from '../constants/fabric';
import { brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

// เลือกเหตุผลพัก/แทงชำรุด (ชุดเดียวกับฟอร์มบนเว็บ › รายการพัก & ชำรุด) — เลือก "อื่นๆ" แล้วต้องกรอกเหตุผลเอง
// ค่าที่ส่งให้ server ประกอบด้วย buildReasonCode(code, otherText) ใน src/constants/fabric.js
export function ReasonPicker({ value, onChange, otherText, onChangeOtherText, disabled = false }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {REASON_CODE_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[type.body2, styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value === 'OTHER' ? (
        <TextInput
          mode="outlined"
          label="ระบุเหตุผล *"
          value={otherText}
          onChangeText={onChangeOtherText}
          maxLength={OTHER_REASON_MAX_LENGTH}
          disabled={disabled}
          autoFocus
          outlineColor={brand.grey[300]}
          activeOutlineColor={brand.primary.main}
          style={styles.input}
          right={<TextInput.Affix text={`${(otherText || '').length}/${OTHER_REASON_MAX_LENGTH}`} />}
        />
      ) : null}
    </View>
  );
}

// ตรวจว่าเลือกเหตุผลครบหรือยัง — คืนข้อความ error หรือ '' ถ้าผ่าน
export function validateReason(code, otherText) {
  if (!code) return 'กรุณาเลือกเหตุผล';
  if (code === 'OTHER' && !(otherText || '').trim()) return 'กรุณากรอกเหตุผล (อื่นๆ)';
  return '';
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: brand.primary.main,
    backgroundColor: sage.tint,
  },
  chipText: { color: brand.grey[700] },
  chipTextActive: { color: sage.text, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF' },
});
