import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { templateApi } from '../src/services/api';

interface CheckItemInput {
  id: string;
  text: string;
  check_type: 'yesno' | 'multiple_choice';
  options: string[];
  default_response: string;
}

export default function NewTemplate() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'woodworking' | 'metalworking' | 'general'>('woodworking');
  const [description, setDescription] = useState('');
  const [checkItems, setCheckItems] = useState<CheckItemInput[]>([]);
  const [loading, setLoading] = useState(false);

  const addCheckItem = () => {
    setCheckItems([
      ...checkItems,
      {
        id: Date.now().toString(),
        text: '',
        check_type: 'yesno',
        options: ['Good', 'Fair', 'Poor'],
        default_response: '',
      },
    ]);
  };

  const updateCheckItem = (id: string, updates: Partial<CheckItemInput>) => {
    setCheckItems(items =>
      items.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeCheckItem = (id: string) => {
    setCheckItems(items => items.filter(item => item.id !== id));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a checklist name');
      return;
    }

    if (checkItems.length === 0) {
      Alert.alert('Error', 'Please add at least one check item');
      return;
    }

    const emptyItems = checkItems.filter(item => !item.text.trim());
    if (emptyItems.length > 0) {
      Alert.alert('Error', 'Please fill in all check item texts');
      return;
    }

    setLoading(true);
    try {
      await templateApi.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        check_items: checkItems.map(item => ({
          text: item.text.trim(),
          check_type: item.check_type,
          options: item.check_type === 'multiple_choice' ? item.options : undefined,
          default_response: item.default_response || undefined,
        })),
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Could not create checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Checklist</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Checklist Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Band Saw Safety Check"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryButtons}>
              {(['woodworking', 'metalworking', 'general'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional description"
              placeholderTextColor="#64748b"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Check Items ({checkItems.length})</Text>
              <TouchableOpacity style={styles.addItemButton} onPress={addCheckItem}>
                <Ionicons name="add" size={20} color="#3b82f6" />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {checkItems.map((item, index) => (
              <View key={item.id} style={styles.checkItemCard}>
                <View style={styles.checkItemHeader}>
                  <Text style={styles.checkItemNumber}>#{index + 1}</Text>
                  <TouchableOpacity onPress={() => removeCheckItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.checkItemInput}
                  placeholder="Check item text"
                  placeholderTextColor="#64748b"
                  value={item.text}
                  onChangeText={(text) => updateCheckItem(item.id, { text })}
                />
                
                <View style={styles.checkTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.checkTypeButton,
                      item.check_type === 'yesno' && styles.checkTypeButtonActive,
                    ]}
                    onPress={() => updateCheckItem(item.id, { check_type: 'yesno' })}
                  >
                    <Text style={[
                      styles.checkTypeText,
                      item.check_type === 'yesno' && styles.checkTypeTextActive,
                    ]}>Yes/No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.checkTypeButton,
                      item.check_type === 'multiple_choice' && styles.checkTypeButtonActive,
                    ]}
                    onPress={() => updateCheckItem(item.id, { check_type: 'multiple_choice' })}
                  >
                    <Text style={[
                      styles.checkTypeText,
                      item.check_type === 'multiple_choice' && styles.checkTypeTextActive,
                    ]}>Multiple Choice</Text>
                  </TouchableOpacity>
                </View>

                {item.check_type === 'multiple_choice' && (
                  <TextInput
                    style={styles.optionsInput}
                    placeholder="Options (comma-separated): Good, Fair, Poor"
                    placeholderTextColor="#64748b"
                    value={item.options.join(', ')}
                    onChangeText={(text) => {
                      const options = text.split(',').map(o => o.trim()).filter(Boolean);
                      updateCheckItem(item.id, { options });
                    }}
                  />
                )}

                {/* Default Answer Selector */}
                <View style={styles.defaultAnswerSection}>
                  <Text style={styles.defaultAnswerLabel}>Default Answer (optional)</Text>
                  <View style={styles.defaultAnswerOptions}>
                    <TouchableOpacity
                      style={[
                        styles.defaultAnswerOption,
                        !item.default_response && styles.defaultAnswerOptionActive,
                      ]}
                      onPress={() => updateCheckItem(item.id, { default_response: '' })}
                    >
                      <Text style={[
                        styles.defaultAnswerOptionText,
                        !item.default_response && styles.defaultAnswerOptionTextActive,
                      ]}>None</Text>
                    </TouchableOpacity>
                    {item.check_type === 'yesno' ? (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.defaultAnswerOption,
                            item.default_response === 'yes' && styles.defaultAnswerOptionActive,
                          ]}
                          onPress={() => updateCheckItem(item.id, { default_response: 'yes' })}
                        >
                          <Text style={[
                            styles.defaultAnswerOptionText,
                            item.default_response === 'yes' && styles.defaultAnswerOptionTextActive,
                          ]}>Yes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.defaultAnswerOption,
                            item.default_response === 'no' && styles.defaultAnswerOptionActive,
                          ]}
                          onPress={() => updateCheckItem(item.id, { default_response: 'no' })}
                        >
                          <Text style={[
                            styles.defaultAnswerOptionText,
                            item.default_response === 'no' && styles.defaultAnswerOptionTextActive,
                          ]}>No</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      item.options.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.defaultAnswerOption,
                            item.default_response === option && styles.defaultAnswerOptionActive,
                          ]}
                          onPress={() => updateCheckItem(item.id, { default_response: option })}
                        >
                          <Text style={[
                            styles.defaultAnswerOptionText,
                            item.default_response === option && styles.defaultAnswerOptionTextActive,
                          ]}>{option}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </View>
              </View>
            ))}

            {checkItems.length === 0 && (
              <View style={styles.emptyItems}>
                <Ionicons name="checkbox-outline" size={40} color="#334155" />
                <Text style={styles.emptyItemsText}>No check items yet</Text>
                <Text style={styles.emptyItemsSubtext}>Tap "Add Item" to get started</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.createButtonText}>Create Checklist</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    fontSize: 16,
    color: '#f8fafc',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  checkItemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  checkItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkItemNumber: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  checkItemInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#f8fafc',
    marginBottom: 10,
  },
  checkTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checkTypeButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 10,
  },
  checkTypeButtonActive: {
    backgroundColor: '#3b82f630',
  },
  checkTypeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  checkTypeTextActive: {
    color: '#3b82f6',
  },
  optionsInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#f8fafc',
    marginTop: 10,
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyItemsText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptyItemsSubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  defaultAnswerSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  defaultAnswerLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  defaultAnswerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defaultAnswerOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  defaultAnswerOptionActive: {
    backgroundColor: '#10b98130',
  },
  defaultAnswerOptionText: {
    fontSize: 13,
    color: '#64748b',
  },
  defaultAnswerOptionTextActive: {
    color: '#10b981',
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
