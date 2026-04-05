import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { templateApi } from '../../src/services/api';
import { ChecklistTemplate } from '../../src/types';

export default function TemplateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      const data = await templateApi.getById(id!);
      setTemplate(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load template');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Checklist',
      'Are you sure you want to delete this checklist template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await templateApi.delete(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Could not delete template');
            }
          },
        },
      ]
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'woodworking': return '#f59e0b';
      case 'metalworking': return '#6366f1';
      default: return '#10b981';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!template) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checklist Details</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.templateHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(template.category) + '20' }]}>
            <Ionicons
              name={template.category === 'woodworking' ? 'hammer' : template.category === 'metalworking' ? 'cog' : 'clipboard'}
              size={32}
              color={getCategoryColor(template.category)}
            />
          </View>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateCategory}>{template.category}</Text>
        </View>

        {template.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{template.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Check Items ({template.check_items.length})</Text>
          {template.check_items.map((item, index) => (
            <View key={item.check_id} style={styles.checkItem}>
              <View style={styles.checkNumber}>
                <Text style={styles.checkNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.checkContent}>
                <Text style={styles.checkText}>{item.text}</Text>
                <View style={styles.checkTypeBadge}>
                  <Ionicons
                    name={item.check_type === 'yesno' ? 'checkbox-outline' : 'list-outline'}
                    size={14}
                    color="#64748b"
                  />
                  <Text style={styles.checkTypeText}>
                    {item.check_type === 'yesno' ? 'Yes/No' : 'Multiple Choice'}
                  </Text>
                </View>
                {item.options && item.options.length > 0 && (
                  <View style={styles.optionsList}>
                    {item.options.map((option, i) => (
                      <Text key={i} style={styles.optionItem}>• {option}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  templateHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  templateName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  templateCategory: {
    fontSize: 16,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  checkItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  checkContent: {
    flex: 1,
  },
  checkText: {
    fontSize: 15,
    color: '#f8fafc',
    lineHeight: 20,
  },
  checkTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  checkTypeText: {
    fontSize: 12,
    color: '#64748b',
  },
  optionsList: {
    marginTop: 8,
    paddingLeft: 4,
  },
  optionItem: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
});
