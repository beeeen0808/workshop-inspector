import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { inspectionApi } from '../../src/services/api';
import { Inspection } from '../../src/types';

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingVoice, setPlayingVoice] = useState<number | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    loadInspection();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [id]);

  const loadInspection = async () => {
    try {
      const data = await inspectionApi.getById(id!);
      setInspection(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load inspection');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const playVoiceNote = async (index: number) => {
    if (!inspection || !inspection.voice_notes) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const base64Audio = inspection.voice_notes[index];
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: base64Audio },
        { shouldPlay: true }
      );
      setSound(newSound);
      setPlayingVoice(index);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoice(null);
        }
      });
    } catch (error) {
      console.log('Error playing voice note:', error);
      Alert.alert('Error', 'Could not play voice note');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPassCount = () => {
    if (!inspection) return { pass: 0, total: 0 };
    const pass = inspection.check_responses.filter(
      r => r.response === 'yes' || r.response === 'Good'
    ).length;
    return { pass, total: inspection.check_responses.length };
  };

  const getStatusColor = (response?: string) => {
    if (!response) return '#64748b';
    if (response === 'yes' || response === 'Good') return '#10b981';
    if (response === 'no' || response === 'Poor' || response === 'Damaged') return '#ef4444';
    return '#f59e0b';
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

  if (!inspection) return null;

  const { pass, total } = getPassCount();
  const passRate = total > 0 ? (pass / total) * 100 : 0;
  const overallColor = passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.machineName}>{inspection.machine_name}</Text>
              <Text style={styles.templateName}>
                {inspection.template_name || 'Custom Inspection'}
              </Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: overallColor + '20' }]}>
              <Text style={[styles.scoreText, { color: overallColor }]}>
                {Math.round(passRate)}%
              </Text>
            </View>
          </View>
          <View style={styles.summaryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={16} color="#64748b" />
              <Text style={styles.metaText}>{inspection.inspector_name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
              <Text style={styles.metaText}>{formatDate(inspection.created_at)}</Text>
            </View>
          </View>
          {total > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${passRate}%`, backgroundColor: overallColor }]}
                />
              </View>
              <Text style={styles.progressText}>{pass}/{total} checks passed</Text>
            </View>
          )}
        </View>

        {/* Check Responses */}
        {inspection.check_responses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check Results</Text>
            {inspection.check_responses.map((check, index) => (
              <View key={check.check_id} style={styles.checkItem}>
                <View style={styles.checkHeader}>
                  <View style={[
                    styles.checkStatus,
                    { backgroundColor: getStatusColor(check.response) + '20' }
                  ]}>
                    <Ionicons
                      name={
                        check.response === 'yes' || check.response === 'Good'
                          ? 'checkmark'
                          : check.response === 'no' || check.response === 'Poor'
                          ? 'close'
                          : 'remove'
                      }
                      size={16}
                      color={getStatusColor(check.response)}
                    />
                  </View>
                  <Text style={styles.checkNumber}>{index + 1}</Text>
                </View>
                <View style={styles.checkContent}>
                  <Text style={styles.checkText}>{check.text}</Text>
                  <Text style={[styles.checkResponse, { color: getStatusColor(check.response) }]}>
                    {check.response || 'Not answered'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {inspection.text_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{inspection.text_notes}</Text>
            </View>
          </View>
        )}

        {/* Photos */}
        {inspection.photo_notes && inspection.photo_notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({inspection.photo_notes.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {inspection.photo_notes.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Voice Notes */}
        {inspection.voice_notes && inspection.voice_notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice Notes ({inspection.voice_notes.length})</Text>
            {inspection.voice_notes.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={styles.voiceNoteItem}
                onPress={() => playVoiceNote(index)}
              >
                <Ionicons
                  name={playingVoice === index ? 'pause-circle' : 'play-circle'}
                  size={32}
                  color="#3b82f6"
                />
                <View style={styles.voiceNoteInfo}>
                  <Text style={styles.voiceNoteName}>Voice Note {index + 1}</Text>
                  <Text style={styles.voiceNoteStatus}>
                    {playingVoice === index ? 'Playing...' : 'Tap to play'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  placeholder: {
    width: 44,
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  machineName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  templateName: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  scoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryMeta: {
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
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
  checkItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkHeader: {
    alignItems: 'center',
    marginRight: 12,
  },
  checkStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkNumber: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  checkContent: {
    flex: 1,
  },
  checkText: {
    fontSize: 15,
    color: '#f8fafc',
    lineHeight: 20,
  },
  checkResponse: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  notesCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notesText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  photo: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginRight: 12,
  },
  voiceNoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceNoteInfo: {
    marginLeft: 12,
  },
  voiceNoteName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f8fafc',
  },
  voiceNoteStatus: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
