import AsyncStorage from '@react-native-async-storage/async-storage';
import { Machine, ChecklistTemplate, Inspection, CheckResponse } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Machines API
export const machineApi = {
  getAll: async (category?: string): Promise<Machine[]> => {
    const url = category 
      ? `${API_URL}/api/machines?category=${category}`
      : `${API_URL}/api/machines`;
    const response = await fetch(url, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch machines');
    return response.json();
  },

  getById: async (machineId: string): Promise<Machine> => {
    const response = await fetch(`${API_URL}/api/machines/${machineId}`, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Machine not found');
    return response.json();
  },

  getByQR: async (qrCodeData: string): Promise<Machine> => {
    const response = await fetch(`${API_URL}/api/machines/qr/${encodeURIComponent(qrCodeData)}`, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Machine not found');
    return response.json();
  },

  create: async (data: { name: string; category: string; description?: string; location?: string }): Promise<Machine> => {
    const response = await fetch(`${API_URL}/api/machines`, {
      method: 'POST',
      headers: await getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create machine');
    return response.json();
  },

  update: async (machineId: string, data: Partial<Machine>): Promise<Machine> => {
    const response = await fetch(`${API_URL}/api/machines/${machineId}`, {
      method: 'PUT',
      headers: await getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update machine');
    return response.json();
  },

  delete: async (machineId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/machines/${machineId}`, {
      method: 'DELETE',
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete machine');
  },
};

// Templates API
export const templateApi = {
  getAll: async (category?: string): Promise<ChecklistTemplate[]> => {
    const url = category 
      ? `${API_URL}/api/templates?category=${category}`
      : `${API_URL}/api/templates`;
    const response = await fetch(url, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  },

  getById: async (templateId: string): Promise<ChecklistTemplate> => {
    const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Template not found');
    return response.json();
  },

  create: async (data: { 
    name: string; 
    category: string; 
    description?: string;
    check_items: { text: string; check_type: string; options?: string[] }[];
  }): Promise<ChecklistTemplate> => {
    const response = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: await getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create template');
    return response.json();
  },

  update: async (templateId: string, data: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> => {
    const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
      method: 'PUT',
      headers: await getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update template');
    return response.json();
  },

  delete: async (templateId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/templates/${templateId}`, {
      method: 'DELETE',
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete template');
  },

  seed: async (): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/api/seed`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to seed templates');
  },
};

// Inspections API
export const inspectionApi = {
  getAll: async (machineId?: string, limit?: number): Promise<Inspection[]> => {
    let url = `${API_URL}/api/inspections`;
    const params = new URLSearchParams();
    if (machineId) params.append('machine_id', machineId);
    if (limit) params.append('limit', limit.toString());
    if (params.toString()) url += `?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch inspections');
    return response.json();
  },

  getById: async (inspectionId: string): Promise<Inspection> => {
    const response = await fetch(`${API_URL}/api/inspections/${inspectionId}`, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Inspection not found');
    return response.json();
  },

  getByMachine: async (machineId: string, limit?: number): Promise<Inspection[]> => {
    let url = `${API_URL}/api/machines/${machineId}/inspections`;
    if (limit) url += `?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch inspections');
    return response.json();
  },

  create: async (data: {
    machine_id: string;
    template_id?: string;
    check_responses: CheckResponse[];
    text_notes?: string;
    photo_notes?: string[];
    voice_notes?: string[];
  }): Promise<Inspection> => {
    const response = await fetch(`${API_URL}/api/inspections`, {
      method: 'POST',
      headers: await getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create inspection');
    return response.json();
  },

  delete: async (inspectionId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/inspections/${inspectionId}`, {
      method: 'DELETE',
      headers: await getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete inspection');
  },
};
