// src/store/studentStore.js
import create from 'zustand';
import axios from 'axios';

export const useStudentStore = create((set) => ({
  student: null,
  loading: false,
  error: null,

  // fetchStudent fetches a student from /api/students/:id
  fetchStudent: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.get(`/api/students/${id}`);
      set({ student: res.data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Unknown error', loading: false });
    }
  },

  // helper to reset state in tests
  reset: () => set({ student: null, loading: false, error: null }),
}));
