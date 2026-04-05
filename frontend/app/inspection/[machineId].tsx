import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { machineApi, templateApi, inspectionApi } from '../../src/services/api';
import { Machine, ChecklistTemplate, CheckResponse } from '../../src/types';

export default function InspectionForm() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const router = useRouter();
  
  const [machine, setMachine] = useState<Machine | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [checkResponses, setCheckResponses] = useState<CheckResponse[]>([]);
  const [textNotes, setTextNotes] = useState('');
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Audio recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    loadData();
  }, [machineId]);

  const loadData = async () => {
    try {
      const [machineData, templatesData] = await Promise.all([
        machineApi.getById(machineId!),
        templateApi.getAll(),
      ]);
      setMachine(machineData);
      setTemplates(templatesData);
      
      // Filter templates by machine category or general
      const relevantTemplates = templatesData.filter(
        t => t.category === machineData.category || t.category === 'general'
      );
      
      if (relevantTemplates.length > 0) {
        setShowTemplateModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not load machine data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setCheckResponses(
      template.check_items.map(item => ({
        check_id: item.check_id,
        text: item.text,
        check_type: item.check_type,
        options: item.options,
        response: undefined,
      }))
    );
    setShowTemplateModal(false);
  };

  const skipTemplate = () => {
    setSelectedTemplate(null);
    setCheckResponses([]);
    setShowTemplateModal(false);
  };

  const updateCheckResponse = (checkId: string, response: string) => {
    setCheckResponses(responses =>
      responses.map(r => (r.check_id === checkId ? { ...r, response } : r))
    );
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant camera roll access to add photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotoNotes([...photoNotes, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant camera access to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotoNotes([...photoNotes, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoNotes(photos => photos.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant microphone access to record voice notes');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.log('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // Convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setVoiceNotes([...voiceNotes, base64]);
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.log('Failed to stop recording:', error);
    }
  };

  const removeVoiceNote = (index: number) => {
    setVoiceNotes(notes => notes.filter((_, i) => i !== index));
  };

  const submitInspection = async () => {
    // Validate that all checks have responses if using template
    if (selectedTemplate) {
      const unanswered = checkResponses.filter(r => !r.response);
      if (unanswered.length > 0) {
        Alert.alert('Incomplete', `Please complete all ${unanswered.length} unanswered checks`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const inspection = await inspectionApi.create({
        machine_id: machineId!,
        template_id: selectedTemplate?.template_id,
        check_responses: checkResponses,
        text_notes: textNotes.trim() || undefined,
        photo_notes: photoNotes.length > 0 ? photoNotes : undefined,
        voice_notes: voiceNotes.length > 0 ? voiceNotes : undefined,
      });
      
      Alert.alert(
        'Success',
        'Inspection submitted successfully',
        [{ text: 'OK', onPress: () => router.replace(`/inspection-detail/${inspection.inspection_id}`) }]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not submit inspection. Please try again.');
    } finally {
      setSubmitting(false);
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

  if (!machine) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Machine Info */}
        <View style={styles.machineInfo}>
          <Ionicons
            name={machine.category === 'woodworking' ? 'hammer' : 'cog'}
            size={24}
            color={machine.category === 'woodworking' ? '#f59e0b' : '#6366f1'}
          />
          <View style={styles.machineDetails}>
            <Text style={styles.machineName}>{machine.name}</Text>
            <Text style={styles.machineCategory}>{machine.category}</Text>
          </View>
        </View>

        {/* Template Selection */}
        {selectedTemplate && (
          <View style={styles.templateBadge}>
            <Ionicons name="clipboard" size={18} color="#3b82f6" />
            <Text style={styles.templateBadgeText}>{selectedTemplate.name}</Text>
            <TouchableOpacity onPress={() => setShowTemplateModal(true)}>
              <Ionicons name="swap-horizontal" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}

        {/* Check Items */}
        {checkResponses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety Checks</Text>
            {checkResponses.map((check, index) => (
              <View key={check.check_id} style={styles.checkCard}>
                <Text style={styles.checkText}>
                  {index + 1}. {check.text}
                </Text>
                
                {check.check_type === 'yesno' ? (
                  <View style={styles.yesNoButtons}>
                    <TouchableOpacity
                      style={[
                        styles.yesNoButton,
                        check.response === 'yes' && styles.yesButton,
                      ]}
                      onPress={() => updateCheckResponse(check.check_id, 'yes')}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={check.response === 'yes' ? '#fff' : '#10b981'}
                      />
                      <Text style={[
                        styles.yesNoButtonText,
                        check.response === 'yes' && styles.yesNoButtonTextActive,
                      ]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.yesNoButton,
                        check.response === 'no' && styles.noButton,
                      ]}
                      onPress={() => updateCheckResponse(check.check_id, 'no')}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color={check.response === 'no' ? '#fff' : '#ef4444'}
                      />
                      <Text style={[
                        styles.yesNoButtonText,
                        check.response === 'no' && styles.yesNoButtonTextActive,
                      ]}>No</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.optionsContainer}>
                    {check.options?.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionButton,
                          check.response === option && styles.optionButtonActive,
                        ]}
                        onPress={() => updateCheckResponse(check.check_id, option)}
                      >
                        <Text style={[
                          styles.optionButtonText,
                          check.response === option && styles.optionButtonTextActive,
                        ]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any additional notes about this inspection..."
            placeholderTextColor="#64748b"
            value={textNotes}
            onChangeText={setTextNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos ({photoNotes.length})</Text>
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
              <Ionicons name="camera" size={22} color="#3b82f6" />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
              <Ionicons name="images" size={22} color="#3b82f6" />
              <Text style={styles.mediaButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
          {photoNotes.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {photoNotes.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Voice Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Notes ({voiceNotes.length})</Text>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={24}
              color={isRecording ? '#ef4444' : '#3b82f6'}
            />
            <Text style={[styles.recordButtonText, isRecording && styles.recordButtonTextActive]}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>
          {voiceNotes.length > 0 && (
            <View style={styles.voiceNotesList}>
              {voiceNotes.map((_, index) => (
                <View key={index} style={styles.voiceNoteItem}>
                  <Ionicons name="musical-notes" size={20} color="#3b82f6" />
                  <Text style={styles.voiceNoteText}>Voice Note {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeVoiceNote(index)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={submitInspection}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Inspection</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Template Selection Modal */}
      <Modal
        visible={showTemplateModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Checklist</Text>
              <TouchableOpacity onPress={skipTemplate}>
                <Ionicons name="close" size={24} color="#f8fafc" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {templates
                .filter(t => t.category === machine.category || t.category === 'general')
                .map((template) => (
                  <TouchableOpacity
                    key={template.template_id}
                    style={styles.templateItem}
                    onPress={() => selectTemplate(template)}
                  >
                    <View style={styles.templateItemInfo}>
                      <Text style={styles.templateItemName}>{template.name}</Text>
                      <Text style={styles.templateItemMeta}>
                        {template.check_items.length} checks • {template.category}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#64748b" />
                  </TouchableOpacity>
                ))}
              <TouchableOpacity style={styles.skipButton} onPress={skipTemplate}>
                <Text style={styles.skipButtonText}>Skip - Notes Only</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  machineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  machineDetails: {
    marginLeft: 12,
  },
  machineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  machineCategory: {
    fontSize: 14,
    color: '#94a3b8',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f620',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  templateBadgeText: {
    flex: 1,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
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
  checkCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkText: {
    fontSize: 15,
    color: '#f8fafc',
    lineHeight: 22,
    marginBottom: 12,
  },
  yesNoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 8,
  },
  yesButton: {
    backgroundColor: '#10b981',
  },
  noButton: {
    backgroundColor: '#ef4444',
  },
  yesNoButtonText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  yesNoButtonTextActive: {
    color: '#fff',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: '#3b82f6',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    fontSize: 15,
    color: '#f8fafc',
    minHeight: 100,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mediaButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  photoScroll: {
    marginTop: 8,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photoThumb: {
    width: 100,
    height: 75,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0f172a',
    borderRadius: 12,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recordButtonActive: {
    backgroundColor: '#ef444420',
    borderColor: '#ef4444',
  },
  recordButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  recordButtonTextActive: {
    color: '#ef4444',
  },
  voiceNotesList: {
    marginTop: 12,
    gap: 8,
  },
  voiceNoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
  },
  voiceNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  templateItemInfo: {
    flex: 1,
  },
  templateItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f8fafc',
  },
  templateItemMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  skipButton: {
    alignItems: 'center',
    padding: 16,
    marginVertical: 8,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#64748b',
  },
});
