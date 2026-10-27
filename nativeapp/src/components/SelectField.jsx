import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal, TextInput } from 'react-native-paper';

import { brand, sage, surface } from '../theme/colors';
import { shadow } from '../theme/shadows';
import { radius } from '../theme/theme';
import { type } from '../theme/typography';

// ช่องเลือกแบบ dropdown — กดแล้วเปิด popup รายการตัวเลือก (ใส่ searchable เพื่อให้พิมพ์ค้นหาได้)
// options: [{ value, label }] — value ที่เลือกอยู่เทียบด้วย === กับ option.value
export function SelectField({
  label,
  placeholder = 'เลือก',
  value,
  options,
  onChange,
  searchable = false,
  disabled = false,
  helperText,
  emptyText = 'ไม่มีตัวเลือก',
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const open = () => {
    if (disabled) return;
    setQuery('');
    setVisible(true);
  };

  const choose = (option) => {
    onChange(option.value);
    setVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[type.subtitle2, styles.label]}>{label}</Text> : null}
      <Pressable
        onPress={open}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          disabled && styles.fieldDisabled,
          pressed && !disabled && styles.fieldPressed,
        ]}
      >
        <Text
          style={[type.body1, selected ? styles.value : styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={brand.grey[500]} />
      </Pressable>
      {helperText ? <Text style={[type.caption, styles.helper]}>{helperText}</Text> : null}

      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[type.subtitle1, styles.modalTitle]}>{label || placeholder}</Text>
            {searchable ? (
              <TextInput
                mode="outlined"
                value={query}
                onChangeText={setQuery}
                placeholder="พิมพ์ค้นหา"
                autoCorrect={false}
                outlineColor={brand.grey[300]}
                activeOutlineColor={brand.primary.main}
                left={<TextInput.Icon icon="magnify" />}
                style={styles.searchInput}
              />
            ) : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={[type.body2, styles.empty]}>{query ? 'ไม่พบรายการที่ค้นหา' : emptyText}</Text>
              ) : (
                filtered.map((option) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={String(option.value)}
                      onPress={() => choose(option)}
                      style={({ pressed }) => [
                        styles.option,
                        active && styles.optionActive,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <Text style={[type.body1, styles.optionLabel, active && styles.optionLabelActive]}>
                        {option.label}
                      </Text>
                      {active ? (
                        <MaterialCommunityIcons name="check" size={20} color={sage.text} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: brand.grey[600],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: brand.grey[300],
    backgroundColor: '#FFFFFF',
  },
  fieldDisabled: {
    backgroundColor: brand.grey[100],
    opacity: 0.6,
  },
  fieldPressed: {
    backgroundColor: brand.grey[100],
  },
  value: {
    flex: 1,
    color: brand.grey[800],
  },
  placeholder: {
    flex: 1,
    color: brand.grey[400],
  },
  helper: {
    color: brand.grey[500],
  },
  modalWrap: {
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
    maxHeight: '80%',
    ...shadow.raised,
  },
  modalTitle: {
    color: brand.grey[800],
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    height: 48,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  optionActive: {
    backgroundColor: sage.tint,
  },
  optionPressed: {
    backgroundColor: brand.grey[100],
  },
  optionLabel: {
    flex: 1,
    color: brand.grey[700],
  },
  optionLabelActive: {
    color: sage.text,
    fontWeight: '700',
  },
  empty: {
    color: brand.grey[500],
    paddingVertical: 12,
    textAlign: 'center',
  },
});
