import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { templateApi } from '../../src/services/api';
import { ChecklistTemplate } from '../../src/types';

export default function TemplatesScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      const data = await templateApi.getAll(filter || undefined);
      setTemplates(data);
    } catch (error) {
      console.log('Error loading templates:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [filter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const handleSeedTemplates = async () => {
    try {
      setLoading(true);
      await templateApi.seed();
      await loadTemplates();
      Alert.alert('Success', 'Default templates have been created');
    } catch (error) {
      Alert.alert('Info', 'Default templates already exist or could not be created');
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'woodworking': return 'hammer';
      case 'metalworking': return 'cog';
      default: return 'clipboard';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'woodworking': return '#f59e0b';
      case 'metalworking': return '#6366f1';
      default: return '#10b981';
    }
  };

  const renderTemplate = ({ item }: { item: ChecklistTemplate }) => (
    <TouchableOpacity
      style={styles.templateCard}
      onPress={() => router.push(`/template/${item.template_id}`)}
    >
      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
        <Ionicons name={getCategoryIcon(item.category) as any} size={24} color={getCategoryColor(item.category)} />
      </View>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateCategory}>{item.category}</Text>
        <View style={styles.checkCountRow}>
          <Ionicons name="checkbox-outline" size={14} color="#64748b" />
          <Text style={styles.checkCount}>{item.check_items.length} checks</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Checklists</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/new-template')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, !filter && styles.filterButtonActive]}
          onPress={() => setFilter(null)}
        >
          <Text style={[styles.filterText, !filter && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'woodworking' && styles.filterButtonActive]}
          onPress={() => setFilter('woodworking')}
        >
          <Ionicons name="hammer" size={16} color={filter === 'woodworking' ? '#fff' : '#f59e0b'} />
          <Text style={[styles.filterText, filter === 'woodworking' && styles.filterTextActive]}>Wood</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'metalworking' && styles.filterButtonActive]}
          onPress={() => setFilter('metalworking')}
        >
          <Ionicons name="cog" size={16} color={filter === 'metalworking' ? '#fff' : '#6366f1'} />
          <Text style={[styles.filterText, filter === 'metalworking' && styles.filterTextActive]}>Metal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'general' && styles.filterButtonActive]}
          onPress={() => setFilter('general')}
        >
          <Ionicons name="clipboard" size={16} color={filter === 'general' ? '#fff' : '#10b981'} />
          <Text style={[styles.filterText, filter === 'general' && styles.filterTextActive]}>General</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="clipboard-outline" size={64} color="#334155" />
          <Text style={styles.emptyText}>No checklists found</Text>
          <Text style={styles.emptySubtext}>Create custom checklists or load defaults</Text>
          <TouchableOpacity style={styles.seedButton} onPress={handleSeedTemplates}>
            <Ionicons name="download" size={20} color="#fff" />
            <Text style={styles.seedButtonText}>Load Default Templates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={templates}
          renderItem={renderTemplate}
          keyExtractor={(item) => item.template_id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  templateCategory: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  checkCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  checkCount: {
    fontSize: 13,
    color: '#64748b',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    textAlign: 'center',
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  seedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
