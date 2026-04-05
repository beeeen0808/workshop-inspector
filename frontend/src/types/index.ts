export interface User {
  user_id: string;
  username: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface Machine {
  machine_id: string;
  name: string;
  category: 'woodworking' | 'metalworking';
  description?: string;
  location?: string;
  qr_code_data: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CheckItem {
  check_id: string;
  text: string;
  check_type: 'yesno' | 'multiple_choice';
  options?: string[];
}

export interface ChecklistTemplate {
  template_id: string;
  name: string;
  category: string;
  description?: string;
  check_items: CheckItem[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CheckResponse {
  check_id: string;
  text: string;
  check_type: string;
  options?: string[];
  response?: string;
}

export interface Inspection {
  inspection_id: string;
  machine_id: string;
  machine_name: string;
  template_id?: string;
  template_name?: string;
  check_responses: CheckResponse[];
  text_notes?: string;
  photo_notes?: string[];
  voice_notes?: string[];
  inspector_id: string;
  inspector_name: string;
  created_at: string;
}
