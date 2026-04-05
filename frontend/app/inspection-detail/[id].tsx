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
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { inspectionApi } from '../../src/services/api';
import { Inspection } from '../../src/types';

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = () => {
    Alert.alert(
      'Delete Inspection',
      'Are you sure you want to delete this inspection? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await inspectionApi.delete(id!);
              Alert.alert('Success', 'Inspection deleted', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Could not delete inspection');
              setDeleting(false);
            }
          },
        },
      ]
    );
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

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  const generatePDFHtml = () => {
    if (!inspection) return '';

    const { pass, total } = getPassCount();
    const passRate = total > 0 ? (pass / total) * 100 : 0;
    const overallColor = passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444';

    const checkResultsHtml = inspection.check_responses.map((check, index) => {
      const statusColor = getStatusColor(check.response);
      const statusIcon = check.response === 'yes' || check.response === 'Good' 
        ? '✓' 
        : check.response === 'no' || check.response === 'Poor' 
        ? '✗' 
        : '—';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${check.text}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 50%; background-color: ${statusColor}20; color: ${statusColor}; font-weight: bold;">
              ${statusIcon}
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${statusColor}; font-weight: 500; text-transform: capitalize;">
            ${check.response || 'Not answered'}
          </td>
        </tr>
      `;
    }).join('');

    const photosHtml = inspection.photo_notes && inspection.photo_notes.length > 0
      ? `
        <div style="margin-top: 30px;">
          <h3 style="color: #334155; font-size: 16px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Photos (${inspection.photo_notes.length})</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${inspection.photo_notes.map((photo, i) => `
              <img src="${photo}" style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" alt="Photo ${i + 1}" />
            `).join('')}
          </div>
        </div>
      `
      : '';

    const voiceNotesHtml = inspection.voice_notes && inspection.voice_notes.length > 0
      ? `
        <div style="margin-top: 30px;">
          <h3 style="color: #334155; font-size: 16px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Voice Notes</h3>
          <p style="color: #64748b;">${inspection.voice_notes.length} voice note(s) recorded (audio files attached separately)</p>
        </div>
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Inspection Report - ${inspection.machine_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
            .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .report-title { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .score-badge { padding: 12px 20px; border-radius: 12px; text-align: center; }
            .score-text { font-size: 28px; font-weight: bold; }
            .score-label { font-size: 12px; color: #64748b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-card { background: #f8fafc; padding: 16px; border-radius: 8px; }
            .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .info-value { font-size: 16px; font-weight: 500; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
            .notes-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 30px; }
            .notes-title { font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 10px; }
            .notes-text { color: #475569; white-space: pre-wrap; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">🔧 Machine Inspector</div>
              <div class="report-title">Inspection Report</div>
            </div>
            <div class="score-badge" style="background-color: ${overallColor}20;">
              <div class="score-text" style="color: ${overallColor};">${Math.round(passRate)}%</div>
              <div class="score-label">Pass Rate</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-label">Machine</div>
              <div class="info-value">${inspection.machine_name}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Checklist Used</div>
              <div class="info-value">${inspection.template_name || 'Custom Inspection'}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Inspector</div>
              <div class="info-value">${inspection.inspector_name}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Date & Time</div>
              <div class="info-value">${formatDate(inspection.created_at)}</div>
            </div>
          </div>

          ${inspection.check_responses.length > 0 ? `
            <h3 style="color: #334155; font-size: 16px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Check Results (${pass}/${total} Passed)</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Check Item</th>
                  <th style="width: 80px; text-align: center;">Status</th>
                  <th style="width: 120px;">Response</th>
                </tr>
              </thead>
              <tbody>
                ${checkResultsHtml}
              </tbody>
            </table>
          ` : ''}

          ${inspection.text_notes ? `
            <div class="notes-box">
              <div class="notes-title">Inspector Notes</div>
              <div class="notes-text">${inspection.text_notes}</div>
            </div>
          ` : ''}

          ${photosHtml}
          ${voiceNotesHtml}

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p>Machine Inspector - School Workshop Safety</p>
          </div>
        </body>
      </html>
    `;
  };

  const exportPDF = async () => {
    if (!inspection) return;

    setExporting(true);
    try {
      const html = generatePDFHtml();
      
      if (Platform.OS === 'web') {
        // For web: Open print dialog which allows saving as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Error', 'Please allow pop-ups to export PDF');
        }
      } else {
        // For mobile: Use Print.printAsync which is more reliable in Expo Go
        // This opens the native print dialog where user can "Save as PDF" or print
        console.log('Opening print dialog...');
        
        await Print.printAsync({
          html,
        });
        
        // If we get here, the print dialog was shown successfully
        console.log('Print dialog completed');
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Error', `Could not export: ${errorMessage}`);
    } finally {
      setExporting(false);
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
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={exportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#3b82f6" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
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

        {/* Export Button */}
        <TouchableOpacity 
          style={styles.exportCardButton} 
          onPress={exportPDF}
          disabled={exporting}
        >
          <Ionicons name="document-text-outline" size={22} color="#3b82f6" />
          <View style={styles.exportCardContent}>
            <Text style={styles.exportCardTitle}>Export Report</Text>
            <Text style={styles.exportCardSubtitle}>Download as PDF</Text>
          </View>
          {exporting ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Ionicons name="download-outline" size={22} color="#3b82f6" />
          )}
        </TouchableOpacity>

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  exportCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  exportCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  exportCardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
